"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  updateDoc,
  arrayRemove,
  addDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import cn from "../utils/cn";
import {
  SimliAgentResponse,
  AgentData,
  AgentType,
  SchoolProfile,
  SubscriptionPlan,
  UserProfile,
} from "../lib/types";

const SIMLI_API_KEY = process.env.NEXT_PUBLIC_SIMLI_API_KEY;

type Tab = "agents" | "schools" | "users";

// ── Helpers ──────────────────────────────────────────────────

/** Try to extract an image URL from the raw Simli agent object. */
function extractSimliImage(agent: SimliAgentResponse): string {
  const candidates = [
    "preview_image",
    "previewImage",
    "preview_url",
    "previewUrl",
    "thumbnail",
    "thumbnail_url",
    "thumbnailUrl",
    "image_url",
    "imageUrl",
    "avatar_url",
    "avatarUrl",
    "face_image",
    "faceImage",
    "face_url",
    "faceUrl",
    "face_preview_url",
    "facePreviewUrl",
  ];
  for (const key of candidates) {
    const val = agent[key];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return "";
}

interface PublishedAgent extends AgentData {}

interface FirestoreUser extends UserProfile {}

export default function AdminPage() {
  const { user, profile } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("agents");

  // Shared
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  // Agents tab
  const [simliAgents, setSimliAgents] = useState<SimliAgentResponse[]>([]);
  const [publishedAgents, setPublishedAgents] = useState<PublishedAgent[]>([]);
  const [editingPublishedId, setEditingPublishedId] = useState<string | null>(null);
  const [editPublishedForm, setEditPublishedForm] = useState<{
    name: string; title: string; description: string; type: AgentType; avatarUrl: string;
  }>({ name: "", title: "", description: "", type: "public", avatarUrl: "" });
  const [editForms, setEditForms] = useState<
    Record<string, { name: string; title: string; type: AgentType; avatarUrl: string }>
  >({});

  // Schools tab
  const [schools, setSchools] = useState<SchoolProfile[]>([]);
  const [schoolForm, setSchoolForm] = useState<{
    name: string;
    subscriptionPlan: SubscriptionPlan;
    customAgentAccess: string[];
  }>({ name: "", subscriptionPlan: "free", customAgentAccess: [] });
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);

  // Users tab
  const [users, setUsers] = useState<FirestoreUser[]>([]);

  const publishedIds = new Set(publishedAgents.map((a) => a.id));

  // ── Fetch all data ─────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Simli agents
      const simliRes = await fetch("https://api.simli.ai/agents", {
        headers: { "x-simli-api-key": SIMLI_API_KEY || "" },
      });
      if (!simliRes.ok) throw new Error(`Simli API error: ${simliRes.status}`);
      const simliData = await simliRes.json();
      // Log first agent to inspect available image fields
      setSimliAgents(Array.isArray(simliData) ? simliData : []);

      // Published agents
      const agentsSnap = await getDocs(collection(db, "agents"));
      const pAgents = agentsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as PublishedAgent[];
      setPublishedAgents(pAgents);

      // Schools
      const schoolsSnap = await getDocs(collection(db, "schools"));
      const sData = schoolsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as SchoolProfile[];
      setSchools(sData);

      // Users
      const usersSnap = await getDocs(collection(db, "users"));
      const uData = usersSnap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email || "",
          name: data.name || "",
          schoolId: data.schoolId ?? null,
          extraAvatarAccess: data.extraAvatarAccess || data.avatarAccess || [],
          createdAt: data.createdAt?.toDate() || new Date(),
        } as FirestoreUser;
      });
      setUsers(uData);
    } catch (err: any) {
      setStatus(`Error cargando datos: ${err.message}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && profile?.email === "admin@admin.com") {
      fetchAll();
    }
  }, [user, profile, fetchAll]);

  // ── Guards ─────────────────────────────────────────────────

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center text-text-secondary">
        Debes iniciar sesion para acceder a esta pagina.
      </div>
    );
  }

  if (profile.email !== "admin@admin.com") {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center text-text-secondary">
        No tienes permisos para acceder a esta pagina.
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // AGENTS TAB HANDLERS
  // ════════════════════════════════════════════════════════════

  const handlePublish = async (agent: SimliAgentResponse) => {
    const autoImage = extractSimliImage(agent);
    const form = editForms[agent.id] || {
      name: agent.name,
      title: "",
      type: "public" as AgentType,
      avatarUrl: autoImage,
    };
    if (!form.name.trim()) {
      setStatus("El nombre es obligatorio.");
      return;
    }
    setActionLoading(agent.id);
    try {
      await setDoc(doc(db, "agents", agent.id), {
        agentId: agent.id,
        name: form.name.trim(),
        title: form.title.trim(),
        description: (agent.system_prompt || "").substring(0, 200),
        avatarUrl: form.avatarUrl || autoImage,
        type: form.type,
      });
      setStatus(`Agente "${form.name}" publicado como ${form.type}.`);
      await fetchAll();
    } catch (err: any) {
      setStatus(`Error al publicar: ${err.message}`);
    }
    setActionLoading(null);
  };

  const handleUnpublish = async (agentId: string) => {
    setActionLoading(agentId);
    try {
      await deleteDoc(doc(db, "agents", agentId));

      // Clean from user extraAvatarAccess
      const usersSnap = await getDocs(collection(db, "users"));
      for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();
        if (data.extraAvatarAccess?.includes(agentId)) {
          await updateDoc(doc(db, "users", userDoc.id), {
            extraAvatarAccess: arrayRemove(agentId),
          });
        }
      }

      // Clean from school customAgentAccess
      const schoolsSnap = await getDocs(collection(db, "schools"));
      for (const schoolDoc of schoolsSnap.docs) {
        const data = schoolDoc.data();
        if (data.customAgentAccess?.includes(agentId)) {
          await updateDoc(doc(db, "schools", schoolDoc.id), {
            customAgentAccess: arrayRemove(agentId),
          });
        }
      }

      setStatus("Agente despublicado y limpiado de usuarios y escuelas.");
      await fetchAll();
    } catch (err: any) {
      setStatus(`Error al despublicar: ${err.message}`);
    }
    setActionLoading(null);
  };

  const handleUpdatePublished = async (agentId: string) => {
    if (!editPublishedForm.name.trim()) {
      setStatus("El nombre es obligatorio.");
      return;
    }
    setActionLoading(agentId);
    try {
      await updateDoc(doc(db, "agents", agentId), {
        name: editPublishedForm.name.trim(),
        title: editPublishedForm.title.trim(),
        description: editPublishedForm.description.trim(),
        type: editPublishedForm.type,
        avatarUrl: editPublishedForm.avatarUrl.trim(),
      });
      setStatus("Agente actualizado.");
      setEditingPublishedId(null);
      await fetchAll();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
    setActionLoading(null);
  };

  const handleSync = async () => {
    setActionLoading("sync");
    setStatus("Sincronizando...");
    try {
      const simliIds = new Set(simliAgents.map((a) => a.id));
      const orphaned = publishedAgents.filter((a) => !simliIds.has(a.id));

      if (orphaned.length === 0) {
        setStatus("Todo sincronizado. No hay agentes huerfanos.");
        setActionLoading(null);
        return;
      }

      for (const agent of orphaned) {
        await deleteDoc(doc(db, "agents", agent.id));

        const usersSnap = await getDocs(collection(db, "users"));
        for (const userDoc of usersSnap.docs) {
          const data = userDoc.data();
          if (data.extraAvatarAccess?.includes(agent.id)) {
            await updateDoc(doc(db, "users", userDoc.id), {
              extraAvatarAccess: arrayRemove(agent.id),
            });
          }
        }
      }
      setStatus(
        `Sync completado. ${orphaned.length} agente(s) huerfano(s) eliminado(s).`
      );
      await fetchAll();
    } catch (err: any) {
      setStatus(`Error en sync: ${err.message}`);
    }
    setActionLoading(null);
  };

  const updateForm = (
    agentId: string,
    field: "name" | "title" | "type" | "avatarUrl",
    value: string
  ) => {
    setEditForms((prev) => ({
      ...prev,
      [agentId]: {
        name: prev[agentId]?.name ?? "",
        title: prev[agentId]?.title ?? "",
        type: (prev[agentId]?.type ?? "public") as AgentType,
        avatarUrl: prev[agentId]?.avatarUrl ?? "",
        [field]: value,
      },
    }));
  };

  const getFormValues = (agent: SimliAgentResponse) => {
    return (
      editForms[agent.id] || {
        name: agent.name,
        title: "",
        type: "public" as AgentType,
        avatarUrl: extractSimliImage(agent),
      }
    );
  };

  // ════════════════════════════════════════════════════════════
  // SCHOOLS TAB HANDLERS
  // ════════════════════════════════════════════════════════════

  const handleSaveSchool = async () => {
    if (!schoolForm.name.trim()) {
      setStatus("El nombre de la escuela es obligatorio.");
      return;
    }
    setActionLoading("school-save");
    try {
      const payload = {
        name: schoolForm.name.trim(),
        subscriptionPlan: schoolForm.subscriptionPlan,
        customAgentAccess: schoolForm.customAgentAccess,
      };

      if (editingSchoolId) {
        await updateDoc(doc(db, "schools", editingSchoolId), payload);
        setStatus(`Escuela "${payload.name}" actualizada.`);
      } else {
        await addDoc(collection(db, "schools"), payload);
        setStatus(`Escuela "${payload.name}" creada.`);
      }
      setSchoolForm({ name: "", subscriptionPlan: "free", customAgentAccess: [] });
      setEditingSchoolId(null);
      await fetchAll();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
    setActionLoading(null);
  };

  const handleEditSchool = (school: SchoolProfile) => {
    setEditingSchoolId(school.id);
    setSchoolForm({
      name: school.name,
      subscriptionPlan: school.subscriptionPlan,
      customAgentAccess: [...school.customAgentAccess],
    });
  };

  const handleDeleteSchool = async (schoolId: string) => {
    setActionLoading(schoolId);
    try {
      await deleteDoc(doc(db, "schools", schoolId));

      // Remove schoolId from users who reference it
      const usersSnap = await getDocs(collection(db, "users"));
      for (const userDoc of usersSnap.docs) {
        if (userDoc.data().schoolId === schoolId) {
          await updateDoc(doc(db, "users", userDoc.id), { schoolId: null });
        }
      }

      setStatus("Escuela eliminada.");
      await fetchAll();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
    setActionLoading(null);
  };

  const toggleCustomAgent = (agentId: string) => {
    setSchoolForm((prev) => {
      const has = prev.customAgentAccess.includes(agentId);
      return {
        ...prev,
        customAgentAccess: has
          ? prev.customAgentAccess.filter((id) => id !== agentId)
          : [...prev.customAgentAccess, agentId],
      };
    });
  };

  // ════════════════════════════════════════════════════════════
  // USERS TAB HANDLERS
  // ════════════════════════════════════════════════════════════

  const handleAssignSchool = async (uid: string, schoolId: string | null) => {
    setActionLoading(uid);
    try {
      await updateDoc(doc(db, "users", uid), { schoolId });
      setStatus(
        schoolId
          ? "Escuela asignada al usuario."
          : "Escuela removida del usuario."
      );
      await fetchAll();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
    setActionLoading(null);
  };

  const handleToggleExtraAccess = async (uid: string, agentId: string) => {
    const u = users.find((u) => u.uid === uid);
    if (!u) return;
    setActionLoading(uid);
    try {
      const has = u.extraAvatarAccess.includes(agentId);
      if (has) {
        await updateDoc(doc(db, "users", uid), {
          extraAvatarAccess: arrayRemove(agentId),
        });
      } else {
        await updateDoc(doc(db, "users", uid), {
          extraAvatarAccess: [...u.extraAvatarAccess, agentId],
        });
      }
      await fetchAll();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
    setActionLoading(null);
  };

  // ── Computed lists ─────────────────────────────────────────

  const published = simliAgents.filter((a) => publishedIds.has(a.id));
  const available = simliAgents.filter((a) => !publishedIds.has(a.id));

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════

  const tabClasses = (tab: Tab) =>
    cn(
      "px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
      activeTab === tab
        ? "bg-accent text-white"
        : "bg-white/5 text-text-secondary border border-border-subtle hover:bg-white/10 hover:text-white"
    );

  return (
    <div className="min-h-screen bg-primary pt-16">
      <Navbar />
      {/* Sticky header */}
      <div className="sticky top-16 z-40 bg-primary/95 backdrop-blur-md border-b border-border-subtle px-4 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-sora font-bold text-2xl">Admin Panel</h1>
              <p className="text-text-secondary text-sm mt-1">
                {simliAgents.length} agentes Simli &middot; {publishedAgents.length}{" "}
                publicados &middot; {schools.length} escuelas &middot;{" "}
                {users.length} usuarios
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchAll}
                disabled={loading}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                  "bg-white/5 text-text-secondary border border-border-subtle",
                  "hover:bg-white/10 hover:text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loading ? "Cargando..." : "Refrescar"}
              </button>
            </div>
          </div>

          {/* Status */}
          {status && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20 text-sm text-teal">
              {status}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2">
            <button className={tabClasses("agents")} onClick={() => setActiveTab("agents")}>
              Agentes
            </button>
            <button className={tabClasses("schools")} onClick={() => setActiveTab("schools")}>
              Escuelas
            </button>
            <button className={tabClasses("users")} onClick={() => setActiveTab("users")}>
              Usuarios
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ═══════════ AGENTS TAB ═══════════ */}
            {activeTab === "agents" && (
              <>
                {/* Action buttons */}
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={handleSync}
                    disabled={actionLoading === "sync"}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                      "bg-red-500/10 text-red-400 border border-red-500/30",
                      "hover:bg-red-500 hover:text-white",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {actionLoading === "sync" ? "Sincronizando..." : "Sync: limpiar huerfanos"}
                  </button>
                </div>

                {/* Published agents */}
                <section className="mb-10">
                  <h2 className="font-sora font-semibold text-lg mb-4 text-accent">
                    Publicados ({published.length})
                  </h2>
                  {published.length === 0 ? (
                    <p className="text-text-secondary text-sm py-4">
                      No hay agentes publicados.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {published.map((agent) => {
                        const pub = publishedAgents.find((p) => p.id === agent.id);
                        return (
                          <div
                            key={agent.id}
                            className="glass-card rounded-2xl p-5 hover:transform-none"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
                                  <h3 className="font-sora font-semibold truncate">
                                    {pub?.name || agent.name}
                                  </h3>
                                  {pub?.title && (
                                    <span className="text-text-secondary text-sm">
                                      — {pub.title}
                                    </span>
                                  )}
                                  {pub?.type && (
                                    <span
                                      className={cn(
                                        "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                        pub.type === "public" && "bg-teal/20 text-teal border-teal/30",
                                        pub.type === "basic" && "bg-blue-400/20 text-blue-400 border-blue-400/30",
                                        pub.type === "premium" && "bg-yellow-400/20 text-yellow-400 border-yellow-400/30",
                                        pub.type === "custom" && "bg-purple-400/20 text-purple-400 border-purple-400/30"
                                      )}
                                    >
                                      {pub.type}
                                    </span>
                                  )}
                                </div>
                                <a
                                  href={`https://app.simli.com/avatars/${agent.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-text-secondary/60 mb-2 font-mono truncate block hover:text-accent transition-colors"
                                >
                                  {agent.id}
                                </a>
                                <p className="text-sm text-text-secondary line-clamp-2">
                                  {(agent.system_prompt || "").substring(0, 150)}
                                  {(agent.system_prompt || "").length > 150 ? "..." : ""}
                                </p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={() => {
                                    if (editingPublishedId === agent.id) {
                                      setEditingPublishedId(null);
                                    } else {
                                      setEditingPublishedId(agent.id);
                                      setEditPublishedForm({
                                        name: pub?.name || agent.name,
                                        title: pub?.title || "",
                                        description: pub?.description || "",
                                        type: pub?.type || "public",
                                        avatarUrl: pub?.avatarUrl || "",
                                      });
                                    }
                                  }}
                                  className="px-3 py-2 rounded-full text-xs font-medium bg-white/5 text-text-secondary border border-border-subtle hover:bg-white/10 hover:text-white transition-all duration-300"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleUnpublish(agent.id)}
                                  disabled={actionLoading === agent.id}
                                  className={cn(
                                    "px-3 py-2 rounded-full text-xs font-medium transition-all duration-300",
                                    "bg-red-500/10 text-red-400 border border-red-500/30",
                                    "hover:bg-red-500 hover:text-white",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                  )}
                                >
                                  {actionLoading === agent.id ? "..." : "Despublicar"}
                                </button>
                              </div>
                            </div>
                            {/* Inline edit form */}
                            {editingPublishedId === agent.id && (
                              <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
                                <div className="flex items-end gap-3">
                                  <div className="flex-1">
                                    <label className="block text-xs text-text-secondary mb-1">Nombre</label>
                                    <input
                                      type="text"
                                      value={editPublishedForm.name}
                                      onChange={(e) => setEditPublishedForm((p) => ({ ...p, name: e.target.value }))}
                                      className="w-full bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block text-xs text-text-secondary mb-1">Titulo</label>
                                    <input
                                      type="text"
                                      value={editPublishedForm.title}
                                      onChange={(e) => setEditPublishedForm((p) => ({ ...p, title: e.target.value }))}
                                      className="w-full bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
                                    />
                                  </div>
                                  <div className="w-32">
                                    <label className="block text-xs text-text-secondary mb-1">Tipo</label>
                                    <select
                                      value={editPublishedForm.type}
                                      onChange={(e) => setEditPublishedForm((p) => ({ ...p, type: e.target.value as AgentType }))}
                                      className="w-full bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                                    >
                                      <option value="public">Public</option>
                                      <option value="basic">Basic</option>
                                      <option value="premium">Premium</option>
                                      <option value="custom">Custom</option>
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs text-text-secondary mb-1">Descripcion</label>
                                  <textarea
                                    value={editPublishedForm.description}
                                    onChange={(e) => setEditPublishedForm((p) => ({ ...p, description: e.target.value }))}
                                    rows={2}
                                    className="w-full bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors resize-none"
                                  />
                                </div>
                                <div className="flex items-end gap-3">
                                  {editPublishedForm.avatarUrl && (
                                    <img
                                      src={editPublishedForm.avatarUrl}
                                      alt=""
                                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1">
                                    <label className="block text-xs text-text-secondary mb-1">Avatar URL</label>
                                    <input
                                      type="text"
                                      value={editPublishedForm.avatarUrl}
                                      onChange={(e) => setEditPublishedForm((p) => ({ ...p, avatarUrl: e.target.value }))}
                                      placeholder="https://..."
                                      className="w-full bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleUpdatePublished(agent.id)}
                                    disabled={actionLoading === agent.id}
                                    className={cn(
                                      "px-4 py-2 rounded-full text-xs font-medium flex-shrink-0 transition-all duration-300",
                                      "bg-accent text-white hover:bg-accent-hover",
                                      "disabled:opacity-50 disabled:cursor-not-allowed"
                                    )}
                                  >
                                    {actionLoading === agent.id ? "..." : "Guardar"}
                                  </button>
                                  <button
                                    onClick={() => setEditingPublishedId(null)}
                                    className="px-4 py-2 rounded-full text-xs font-medium bg-white/5 text-text-secondary border border-border-subtle hover:bg-white/10 hover:text-white transition-all duration-300"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Available agents */}
                <section>
                  <h2 className="font-sora font-semibold text-lg mb-4 text-text-secondary">
                    Disponibles en Simli ({available.length})
                  </h2>
                  {available.length === 0 ? (
                    <p className="text-text-secondary text-sm py-4">
                      Todos los agentes de Simli estan publicados.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {available.map((agent) => {
                        const form = getFormValues(agent);
                        return (
                          <div
                            key={agent.id}
                            className="glass-card rounded-2xl p-5 hover:transform-none"
                          >
                            <div className="mb-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 rounded-full bg-text-secondary/40 flex-shrink-0" />
                                <h3 className="font-sora font-semibold text-text-secondary">
                                  {agent.name}
                                </h3>
                              </div>
                              <a
                                href={`https://app.simli.com/avatars/${agent.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-text-secondary/60 mb-2 font-mono truncate block hover:text-accent transition-colors"
                              >
                                {agent.id}
                              </a>
                              <p className="text-sm text-text-secondary/70 line-clamp-2">
                                {(agent.system_prompt || "").substring(0, 150)}
                                {(agent.system_prompt || "").length > 150 ? "..." : ""}
                              </p>
                            </div>

                            {/* Inline publish form */}
                            <div className="space-y-3 mt-4">
                              <div className="flex items-end gap-3">
                                <div className="flex-1">
                                  <label className="block text-xs text-text-secondary mb-1">
                                    Nombre
                                  </label>
                                  <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) =>
                                      updateForm(agent.id, "name", e.target.value)
                                    }
                                    placeholder={agent.name}
                                    className="w-full bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xs text-text-secondary mb-1">
                                    Titulo
                                  </label>
                                  <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) =>
                                      updateForm(agent.id, "title", e.target.value)
                                    }
                                    placeholder="Ej: The Founding Father"
                                    className="w-full bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
                                  />
                                </div>
                              </div>
                              <div className="flex items-end gap-3">
                                <div className="flex-1">
                                  <label className="block text-xs text-text-secondary mb-1">
                                    Avatar URL
                                  </label>
                                  <input
                                    type="text"
                                    value={form.avatarUrl}
                                    onChange={(e) =>
                                      updateForm(agent.id, "avatarUrl", e.target.value)
                                    }
                                    placeholder="https://..."
                                    className="w-full bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
                                  />
                                </div>
                                <div className="w-32">
                                  <label className="block text-xs text-text-secondary mb-1">
                                    Tipo
                                  </label>
                                  <select
                                    value={form.type}
                                    onChange={(e) =>
                                      updateForm(agent.id, "type", e.target.value)
                                    }
                                    className="w-full bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                                  >
                                    <option value="public">Public</option>
                                    <option value="basic">Basic</option>
                                    <option value="premium">Premium</option>
                                    <option value="custom">Custom</option>
                                  </select>
                                </div>
                                <button
                                  onClick={() => handlePublish(agent)}
                                  disabled={actionLoading === agent.id}
                                  className={cn(
                                    "px-4 py-2 rounded-full text-xs font-medium flex-shrink-0 transition-all duration-300",
                                    "bg-accent text-white hover:bg-accent-hover",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                  )}
                                >
                                  {actionLoading === agent.id ? "..." : "Publicar"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* ═══════════ SCHOOLS TAB ═══════════ */}
            {activeTab === "schools" && (
              <>
                {/* School form */}
                <section className="glass-card rounded-2xl p-6 mb-8">
                  <h2 className="font-sora font-semibold text-lg mb-4">
                    {editingSchoolId ? "Editar Escuela" : "Nueva Escuela"}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={schoolForm.name}
                        onChange={(e) =>
                          setSchoolForm((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="Nombre de la escuela"
                        className="w-full bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        Plan de suscripcion
                      </label>
                      <select
                        value={schoolForm.subscriptionPlan}
                        onChange={(e) =>
                          setSchoolForm((p) => ({
                            ...p,
                            subscriptionPlan: e.target.value as SubscriptionPlan,
                          }))
                        }
                        className="w-full bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                      >
                        <option value="free">Free</option>
                        <option value="basic">Basic</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>
                  </div>

                  {/* Custom agents selector */}
                  <div className="mb-4">
                    <label className="block text-xs text-text-secondary mb-2">
                      Agentes custom (acceso adicional)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {publishedAgents.map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => toggleCustomAgent(agent.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                            schoolForm.customAgentAccess.includes(agent.id)
                              ? "bg-accent/20 text-accent border-accent/40"
                              : "bg-white/5 text-text-secondary border-border-subtle hover:bg-white/10"
                          )}
                        >
                          {agent.name}
                        </button>
                      ))}
                      {publishedAgents.length === 0 && (
                        <span className="text-text-secondary/50 text-xs">
                          No hay agentes publicados para asignar.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveSchool}
                      disabled={actionLoading === "school-save"}
                      className={cn(
                        "px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
                        "bg-accent text-white hover:bg-accent-hover",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {actionLoading === "school-save"
                        ? "Guardando..."
                        : editingSchoolId
                        ? "Actualizar"
                        : "Crear Escuela"}
                    </button>
                    {editingSchoolId && (
                      <button
                        onClick={() => {
                          setEditingSchoolId(null);
                          setSchoolForm({
                            name: "",
                            subscriptionPlan: "free",
                            customAgentAccess: [],
                          });
                        }}
                        className="px-5 py-2 rounded-full text-sm font-medium bg-white/5 text-text-secondary border border-border-subtle hover:bg-white/10 hover:text-white transition-all duration-300"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </section>

                {/* Schools list */}
                <section>
                  <h2 className="font-sora font-semibold text-lg mb-4 text-accent">
                    Escuelas ({schools.length})
                  </h2>
                  {schools.length === 0 ? (
                    <p className="text-text-secondary text-sm py-4">
                      No hay escuelas creadas.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {schools.map((school) => (
                        <div
                          key={school.id}
                          className="glass-card rounded-2xl p-5 hover:transform-none"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-sora font-semibold">
                                  {school.name}
                                </h3>
                                <span
                                  className={cn(
                                    "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                    school.subscriptionPlan === "free" && "bg-white/10 text-text-secondary border-border-subtle",
                                    school.subscriptionPlan === "basic" && "bg-blue-400/20 text-blue-400 border-blue-400/30",
                                    school.subscriptionPlan === "premium" && "bg-yellow-400/20 text-yellow-400 border-yellow-400/30"
                                  )}
                                >
                                  {school.subscriptionPlan}
                                </span>
                              </div>
                              <p className="text-xs text-text-secondary/60 mb-1 font-mono">
                                ID: {school.id}
                              </p>
                              {school.customAgentAccess.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  <span className="text-xs text-text-secondary mr-1">
                                    Custom:
                                  </span>
                                  {school.customAgentAccess.map((aid) => {
                                    const a = publishedAgents.find((p) => p.id === aid);
                                    return (
                                      <span
                                        key={aid}
                                        className="text-[10px] px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-400 border border-purple-400/30"
                                      >
                                        {a?.name || aid}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                onClick={() => handleEditSchool(school)}
                                className="px-3 py-2 rounded-full text-xs font-medium bg-white/5 text-text-secondary border border-border-subtle hover:bg-white/10 hover:text-white transition-all duration-300"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteSchool(school.id)}
                                disabled={actionLoading === school.id}
                                className={cn(
                                  "px-3 py-2 rounded-full text-xs font-medium transition-all duration-300",
                                  "bg-red-500/10 text-red-400 border border-red-500/30",
                                  "hover:bg-red-500 hover:text-white",
                                  "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                              >
                                {actionLoading === school.id ? "..." : "Eliminar"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* ═══════════ USERS TAB ═══════════ */}
            {activeTab === "users" && (
              <section>
                <h2 className="font-sora font-semibold text-lg mb-4 text-accent">
                  Usuarios ({users.length})
                </h2>
                {users.length === 0 ? (
                  <p className="text-text-secondary text-sm py-4">
                    No hay usuarios registrados.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {users.map((u) => {
                      const userSchool = schools.find(
                        (s) => s.id === u.schoolId
                      );
                      return (
                        <div
                          key={u.uid}
                          className="glass-card rounded-2xl p-5 hover:transform-none"
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-sora font-semibold truncate">
                                {u.name}
                              </h3>
                              <p className="text-xs text-text-secondary truncate">
                                {u.email}
                              </p>
                            </div>
                          </div>

                          {/* School assignment */}
                          <div className="mb-3">
                            <label className="block text-xs text-text-secondary mb-1">
                              Escuela
                            </label>
                            <select
                              value={u.schoolId || ""}
                              onChange={(e) =>
                                handleAssignSchool(
                                  u.uid,
                                  e.target.value || null
                                )
                              }
                              disabled={actionLoading === u.uid}
                              className="w-full sm:w-64 bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
                            >
                              <option value="">Sin escuela (free)</option>
                              {schools.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.subscriptionPlan})
                                </option>
                              ))}
                            </select>
                            {userSchool && (
                              <span className="ml-2 text-xs text-text-secondary">
                                Plan: {userSchool.subscriptionPlan}
                              </span>
                            )}
                          </div>

                          {/* Extra avatar access */}
                          <div>
                            <label className="block text-xs text-text-secondary mb-2">
                              Extra avatar access
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {publishedAgents.map((agent) => (
                                <button
                                  key={agent.id}
                                  type="button"
                                  onClick={() =>
                                    handleToggleExtraAccess(u.uid, agent.id)
                                  }
                                  disabled={actionLoading === u.uid}
                                  className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                                    "disabled:opacity-50 disabled:cursor-not-allowed",
                                    u.extraAvatarAccess.includes(agent.id)
                                      ? "bg-accent/20 text-accent border-accent/40"
                                      : "bg-white/5 text-text-secondary border-border-subtle hover:bg-white/10"
                                  )}
                                >
                                  {agent.name}
                                </button>
                              ))}
                              {publishedAgents.length === 0 && (
                                <span className="text-text-secondary/50 text-xs">
                                  No hay agentes publicados.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
