import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Plus, GraduationCap, BookOpen, Play, Trash2, Edit2, ChevronDown, ChevronRight,
  Video, Send, EyeOff, Loader2, Sparkles, Eye, Search, RefreshCw, X, Image as ImageIcon,
  Wand2, Check, Lightbulb, MessageSquare, User, Users, FolderPlus, FolderSync, HardDrive,
  Link2, Unlink
} from "lucide-react";
import { TrainingViewer } from "@/components/training/TrainingViewer";

// ── Types ──
type Course = {
  id: string; title: string; description: string; cover_url: string | null;
  target_role: string; sort_order: number; active: boolean; created_at: string;
  published: boolean; published_at: string | null;
};
type Module = {
  id: string; course_id: string; title: string; description: string; sort_order: number;
  drive_folder_id?: string | null;
};
type Lesson = {
  id: string; module_id: string; title: string; description: string;
  video_url: string; video_type: string; cover_url: string | null; sort_order: number;
  assigned_admin_id: string | null; drive_folder_id?: string | null;
};
type TeamMember = { id: string; name: string; avatar_url: string | null; member_role: string };
type WhatsAppContact = { id: string; phone: string; team_member_id: string | null; user_id: string | null };

// ── Pexels cover search ──
async function searchPexelCovers(query: string): Promise<{ id: number; url: string; thumb: string; photographer: string }[]> {
  try {
    const { data, error } = await supabase.functions.invoke("search-covers", {
      body: { query, per_page: 12 },
    });
    if (error || !data?.images) return [];
    return data.images;
  } catch {
    return [];
  }
}

export default function TrainingAdminPage() {
  const qc = useQueryClient();
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewRole, setPreviewRole] = useState("all");

  const { data: courses = [] } = useQuery({
    queryKey: ["training-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("training_courses").select("*").order("sort_order");
      return (data || []) as Course[];
    },
  });

  const { data: modules = [] } = useQuery({
    queryKey: ["training-modules"],
    queryFn: async () => {
      const { data } = await supabase.from("training_modules").select("*").order("sort_order");
      return (data || []) as Module[];
    },
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ["training-lessons"],
    queryFn: async () => {
      const { data } = await supabase.from("training_lessons").select("*").order("sort_order");
      return (data || []) as Lesson[];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-training"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("*").eq("active", true);
      return (data || []) as TeamMember[];
    },
  });

  const { data: whatsappContacts = [] } = useQuery({
    queryKey: ["whatsapp-contacts-training"],
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_contacts").select("*").eq("active", true);
      return (data || []) as WhatsAppContact[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-training"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, team_member_id");
      return (data || []) as { id: string; team_member_id: string | null }[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["training-courses"] });
    qc.invalidateQueries({ queryKey: ["training-modules"] });
    qc.invalidateQueries({ queryKey: ["training-lessons"] });
  };

  // ── Preview Mode ──
  if (previewMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Preview — Visão do Usuário</h2>
            <Badge variant="outline" className="text-[9px]">
              {previewRole === "all" ? "Todos" : previewRole === "sdr" ? "SDR" : "Closer"}
            </Badge>
          </div>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setPreviewMode(false)}>
            <X size={12} /> Voltar ao Admin
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <TrainingViewer memberRole={previewRole} previewAll />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <GraduationCap size={20} className="text-primary" /> Treinamentos
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie cursos, módulos e aulas para sua equipe</p>
        </div>
        <div className="flex items-center gap-2">
          <DriveConnectionStatus />
          {/* Preview buttons */}
          <Select value={previewRole} onValueChange={setPreviewRole}>
            <SelectTrigger className="w-[100px] h-8 text-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sdr">SDR</SelectItem>
              <SelectItem value="closer">Closer</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setPreviewMode(true)}>
            <Eye size={14} /> Visualizar
          </Button>
          <AiCourseGeneratorDialog onSaved={invalidateAll} />
          <AddCourseDialog onSaved={invalidateAll} />
        </div>
      </div>

      {courses.length === 0 ? (
        <Card className="p-8 text-center">
          <GraduationCap size={40} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum curso criado ainda</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo Curso" para começar</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const courseModules = modules.filter(m => m.course_id === course.id);
            const isExpanded = expandedCourse === course.id;
            return (
              <Card key={course.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                >
                  {course.cover_url ? (
                    <img src={course.cover_url} alt="" className="w-16 h-10 rounded-md object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <GraduationCap size={16} className="text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{course.title}</p>
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {course.target_role === "all" ? "Todos" : course.target_role === "sdr" ? "SDR" : "Closer"}
                      </Badge>
                      {!course.active && <Badge variant="secondary" className="text-[9px]">Inativo</Badge>}
                      {course.published ? (
                        <Badge className="text-[9px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30 shrink-0">Publicado</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] shrink-0">Rascunho</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{courseModules.length} módulos</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ChangeCoverButton itemId={course.id} table="training_courses" currentTitle={course.title} onDone={invalidateAll} />
                    {!course.published && <PublishButton course={course} onPublished={invalidateAll} />}
                    {course.published && <UnpublishButton courseId={course.id} onDone={invalidateAll} />}
                    <EditCourseDialog course={course} onSaved={invalidateAll} />
                    <DeleteButton table="training_courses" id={course.id} onDeleted={invalidateAll} />
                    {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-secondary/10 p-3 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Módulos</p>
                      <div className="flex items-center gap-1">
                        <DriveCreateFoldersButton courseId={course.id} courseTitle={course.title} onDone={invalidateAll} />
                        <DriveSyncButton courseId={course.id} courseTitle={course.title} onDone={invalidateAll} />
                        <SendScriptsButton scope="course" courseTitle={course.title} modules={courseModules} lessons={lessons} teamMembers={teamMembers} whatsappContacts={whatsappContacts} profiles={profiles} />
                        <AddModuleDialog courseId={course.id} onSaved={invalidateAll} />
                      </div>
                    </div>
                    {courseModules.length === 0 && (
                      <p className="text-xs text-muted-foreground/60 text-center py-3">Nenhum módulo</p>
                    )}
                    {courseModules.map((mod) => {
                      const modLessons = lessons.filter(l => l.module_id === mod.id);
                      const modExpanded = expandedModule === mod.id;
                      return (
                        <div key={mod.id} className="rounded-lg border border-border bg-background">
                          <div
                            className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-secondary/20 transition-colors"
                            onClick={() => setExpandedModule(modExpanded ? null : mod.id)}
                          >
                            <BookOpen size={14} className="text-primary shrink-0" />
                            <p className="text-xs font-semibold flex-1 truncate">{mod.title}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0">{modLessons.length} aulas</span>
                            <SendScriptsButton scope="module" courseTitle={course.title} moduleTitle={mod.title} lessons={modLessons} teamMembers={teamMembers} whatsappContacts={whatsappContacts} profiles={profiles} />
                            <DeleteButton table="training_modules" id={mod.id} onDeleted={invalidateAll} size="sm" />
                            {modExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </div>

                          {modExpanded && (
                            <div className="border-t border-border p-2.5 space-y-1.5 bg-secondary/5">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wider">Aulas</p>
                                <div className="flex items-center gap-1">
                                  <AiLessonsDialog moduleId={mod.id} moduleTitle={mod.title} courseTitle={course.title} existingLessons={modLessons} onSaved={invalidateAll} />
                                  <AddLessonDialog moduleId={mod.id} onSaved={invalidateAll} />
                                </div>
                              </div>
                              {modLessons.length === 0 && (
                                <p className="text-[10px] text-muted-foreground/60 text-center py-2">Nenhuma aula</p>
                              )}
                              {modLessons.map((lesson) => {
                                const assignedAdmin = lesson.assigned_admin_id ? teamMembers.find(m => m.id === lesson.assigned_admin_id) : null;
                                return (
                                  <div key={lesson.id} className="flex items-center gap-2 p-2 rounded-md bg-background border border-border/50">
                                    {lesson.cover_url ? (
                                      <img src={lesson.cover_url} alt="" className="w-12 h-8 rounded object-cover shrink-0" />
                                    ) : (
                                      <div className="w-12 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                        <Play size={10} className="text-primary" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-semibold truncate">{lesson.title}</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-[9px] text-muted-foreground truncate flex items-center gap-1">
                                          <Video size={8} /> {lesson.video_type === "youtube" ? "YouTube" : "Drive"}
                                        </p>
                                        {assignedAdmin && (
                                          <span className="text-[9px] text-primary flex items-center gap-0.5">
                                            <User size={7} /> {assignedAdmin.name.split(" ")[0]}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <AssignAdminSelect lessonId={lesson.id} currentAdminId={lesson.assigned_admin_id} teamMembers={teamMembers} onSaved={invalidateAll} />
                                    <SendScriptsButton scope="lesson" courseTitle={course.title} moduleTitle={mod.title} lessons={[lesson]} teamMembers={teamMembers} whatsappContacts={whatsappContacts} profiles={profiles} assignedAdminId={lesson.assigned_admin_id} />
                                    <ChangeCoverButton itemId={lesson.id} table="training_lessons" currentTitle={lesson.title} onDone={invalidateAll} size="sm" />
                                    <EditLessonDialog lesson={lesson} onSaved={invalidateAll} />
                                    <DeleteButton table="training_lessons" id={lesson.id} onDeleted={invalidateAll} size="sm" />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Change Cover Dialog (Pexels search) ──
function ChangeCoverButton({ itemId, table, currentTitle, onDone, size = "md" }: {
  itemId: string; table: string; currentTitle: string; onDone: () => void; size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(currentTitle);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const results = await searchPexelCovers(query);
    setImages(results);
    setLoading(false);
  };

  const handleSelect = async (url: string) => {
    setSaving(true);
    const { error } = await supabase.from(table as any).update({ cover_url: url }).eq("id", itemId);
    setSaving(false);
    if (error) { toast.error("Erro ao atualizar capa"); return; }
    toast.success("Capa atualizada!");
    setOpen(false);
    onDone();
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
    setQuery(currentTitle);
    setImages([]);
    // Auto-search on open
    setTimeout(() => {
      searchPexelCovers(currentTitle).then(r => setImages(r));
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={handleOpen}
        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        title="Trocar capa"
      >
        <ImageIcon size={size === "sm" ? 10 : 12} />
      </button>
      <DialogContent className="max-w-2xl" onClick={e => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Buscar Capa — Pexels</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Pesquisar imagens..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading} size="sm" className="gap-1.5">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar
            </Button>
          </div>

          {saving && (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Salvando...
            </div>
          )}

          {!saving && images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
              {images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => handleSelect(img.url)}
                  className="group relative rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all"
                >
                  <img src={img.thumb} alt={img.alt} className="w-full h-20 object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Selecionar</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground truncate px-1 py-0.5">📸 {img.photographer}</p>
                </button>
              ))}
            </div>
          )}

          {!saving && !loading && images.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">
              Pesquise por um termo para ver imagens do Pexels
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── AI Course Generator Dialog ──
type AiLesson = { title: string; description: string; dica_gravacao: string };
type AiModule = { title: string; description: string; lessons: AiLesson[] };
type AiCourseStructure = { title: string; description: string; modules: AiModule[] };

function AiCourseGeneratorDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [generating, setGenerating] = useState(false);
  const [structure, setStructure] = useState<AiCourseStructure | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedMod, setExpandedMod] = useState<number | null>(0);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [structureMode, setStructureMode] = useState<"auto" | "manual">("auto");
  const [customModules, setCustomModules] = useState(3);
  const [customLessons, setCustomLessons] = useState(3);

  const [equipment, setEquipment] = useState("celular");
  const [recordStyle, setRecordStyle] = useState("talking_head");
  const [videoFormat, setVideoFormat] = useState("curto");
  const [extraNotes, setExtraNotes] = useState("");

  const equipmentOptions = [
    { value: "celular", label: "📱 Celular" },
    { value: "webcam", label: "💻 Webcam/Notebook" },
    { value: "camera_pro", label: "🎥 Câmera profissional" },
    { value: "tela", label: "🖥️ Gravação de tela" },
  ];
  const styleOptions = [
    { value: "talking_head", label: "🗣️ Talking Head" },
    { value: "tela_narrada", label: "🖥️ Tela narrada" },
    { value: "roleplay", label: "🎭 Roleplay/Simulação" },
    { value: "slides", label: "📊 Slides com narração" },
    { value: "misto", label: "🔀 Misto (varia por aula)" },
  ];
  const formatOptions = [
    { value: "curto", label: "⚡ Curto (3-5 min)" },
    { value: "medio", label: "⏱️ Médio (5-10 min)" },
    { value: "longo", label: "🕐 Longo (10-20 min)" },
  ];
  const handleGenerate = async () => {
    if (!idea.trim()) return;
    setGenerating(true);
    setStructure(null);
    try {
      const body: any = { idea: idea.trim(), targetRole, equipment, recordStyle, videoFormat };
      if (extraNotes.trim()) body.extraNotes = extraNotes.trim();
      if (structureMode === "manual") {
        body.numModules = customModules;
        body.numLessonsPerModule = customLessons;
      }
      const { data, error } = await supabase.functions.invoke("generate-course", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStructure(data);
      setExpandedMod(0);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar estrutura");
    }
    setGenerating(false);
  };

  const handleCreate = async () => {
    if (!structure) return;
    setCreating(true);
    try {
      const covers = await searchPexelCovers(structure.title);
      const cover = covers.length > 0 ? covers[0].url : null;
      const { data: course, error: courseErr } = await supabase
        .from("training_courses")
        .insert({ title: structure.title, description: structure.description, target_role: targetRole, cover_url: cover })
        .select("id")
        .single();
      if (courseErr || !course) throw courseErr || new Error("Erro ao criar curso");

      for (let mi = 0; mi < structure.modules.length; mi++) {
        const mod = structure.modules[mi];
        const { data: modData, error: modErr } = await supabase
          .from("training_modules")
          .insert({ course_id: course.id, title: mod.title, description: mod.description || "", sort_order: mi })
          .select("id")
          .single();
        if (modErr || !modData) continue;

        const lessonInserts = mod.lessons.map((l, li) => ({
          module_id: modData.id,
          title: l.title,
          description: `${l.description}\n\n💡 Dica de gravação: ${l.dica_gravacao}`,
          video_url: "",
          video_type: "youtube" as const,
          sort_order: li,
        }));
        if (lessonInserts.length > 0) {
          await supabase.from("training_lessons").insert(lessonInserts);
        }
      }

      toast.success("Curso criado com sucesso! Agora adicione os links dos vídeos.");
      setOpen(false);
      setStructure(null);
      setIdea("");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar curso");
    }
    setCreating(false);
  };

  // ── Editable helpers ──
  const updateStructure = (updater: (s: AiCourseStructure) => AiCourseStructure) => {
    if (structure) setStructure(updater(structure));
  };

  const updateModuleTitle = (mi: number, val: string) => {
    updateStructure(s => ({ ...s, modules: s.modules.map((m, i) => i === mi ? { ...m, title: val } : m) }));
  };
  const updateModuleDesc = (mi: number, val: string) => {
    updateStructure(s => ({ ...s, modules: s.modules.map((m, i) => i === mi ? { ...m, description: val } : m) }));
  };
  const updateLessonTitle = (mi: number, li: number, val: string) => {
    updateStructure(s => ({
      ...s, modules: s.modules.map((m, i) => i === mi ? {
        ...m, lessons: m.lessons.map((l, j) => j === li ? { ...l, title: val } : l)
      } : m)
    }));
  };
  const updateLessonDesc = (mi: number, li: number, val: string) => {
    updateStructure(s => ({
      ...s, modules: s.modules.map((m, i) => i === mi ? {
        ...m, lessons: m.lessons.map((l, j) => j === li ? { ...l, description: val } : l)
      } : m)
    }));
  };
  const removeLesson = (mi: number, li: number) => {
    updateStructure(s => ({
      ...s, modules: s.modules.map((m, i) => i === mi ? {
        ...m, lessons: m.lessons.filter((_, j) => j !== li)
      } : m)
    }));
  };
  const removeModule = (mi: number) => {
    updateStructure(s => ({ ...s, modules: s.modules.filter((_, i) => i !== mi) }));
    if (expandedMod === mi) setExpandedMod(null);
  };
  const addLesson = (mi: number) => {
    updateStructure(s => ({
      ...s, modules: s.modules.map((m, i) => i === mi ? {
        ...m, lessons: [...m.lessons, { title: "Nova Aula", description: "Descrição da aula", dica_gravacao: "Defina o formato e duração" }]
      } : m)
    }));
  };
  const addModule = () => {
    updateStructure(s => ({
      ...s, modules: [...s.modules, { title: "Novo Módulo", description: "", lessons: [] }]
    }));
    setExpandedMod(structure ? structure.modules.length : 0);
  };

  const totalLessons = structure?.modules.reduce((sum, m) => sum + m.lessons.length, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setStructure(null); setIdea(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
          <Wand2 size={14} /> IA Gerar Curso
        </Button>
      </DialogTrigger>
       <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Wand2 size={16} className="text-primary" /> Gerar Curso com IA
          </DialogTitle>
        </DialogHeader>

        {!structure ? (
          <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pt-1 pr-3">
            <div>
              <label className="text-[11px] font-medium text-foreground mb-1 block">Descreva a ideia do curso</label>
              <Textarea
                placeholder="Ex: Curso de cold calling para SDRs iniciantes..."
                value={idea}
                onChange={e => setIdea(e.target.value)}
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">Público-alvo</label>
                <Select value={targetRole} onValueChange={setTargetRole}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sdr">SDR</SelectItem>
                    <SelectItem value="closer">Closer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">Estrutura</label>
                <Select value={structureMode} onValueChange={(v: "auto" | "manual") => setStructureMode(v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">✨ IA decide</SelectItem>
                    <SelectItem value="manual">✏️ Personalizar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {structureMode === "manual" && (
              <div className="grid grid-cols-3 gap-2 bg-secondary/30 rounded-lg p-2.5 items-end">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Módulos</label>
                  <Select value={String(customModules)} onValueChange={v => setCustomModules(Number(v))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Aulas/módulo</label>
                  <Select value={String(customLessons)} onValueChange={v => setCustomLessons(Number(v))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground pb-1">= <strong className="text-foreground">{customModules * customLessons}</strong> aulas</p>
              </div>
            )}

            {/* Recording preferences */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">Equipamento</label>
                <Select value={equipment} onValueChange={setEquipment}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {equipmentOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">Estilo</label>
                <Select value={recordStyle} onValueChange={setRecordStyle}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {styleOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">Duração</label>
                <Select value={videoFormat} onValueChange={setVideoFormat}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {formatOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-foreground mb-1 block">Observações extras <span className="text-muted-foreground font-normal">(opcional)</span></label>
              <Input
                placeholder="Ex: Usar fundo branco, gravar em português formal, incluir exemplos reais..."
                value={extraNotes}
                onChange={e => setExtraNotes(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <Button onClick={handleGenerate} disabled={generating || !idea.trim()} className="w-full gap-2 h-9 text-xs">
              {generating ? <><Loader2 size={14} className="animate-spin" /> Gerando...</> : <><Wand2 size={14} /> Gerar Estrutura</>}
            </Button>
          </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3 pt-2">
            {/* Editable Header */}
            <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
              <Input
                value={structure.title}
                onChange={e => setStructure({ ...structure, title: e.target.value })}
                className="text-sm font-bold h-8 bg-background"
              />
              <Input
                value={structure.description}
                onChange={e => setStructure({ ...structure, description: e.target.value })}
                className="text-[11px] h-7 bg-background"
                placeholder="Descrição do curso"
              />
              <div className="flex gap-3 mt-1">
                <Badge variant="outline" className="text-[9px]">{structure.modules.length} módulos</Badge>
                <Badge variant="outline" className="text-[9px]">{totalLessons} aulas</Badge>
                <span className="text-[9px] text-muted-foreground flex items-center gap-1"><Edit2 size={8} /> Clique para editar qualquer campo</span>
              </div>
            </div>

            {/* Editable Modules */}
            <ScrollArea className="flex-1 max-h-[350px]">
              <div className="space-y-2 pr-3">
                {structure.modules.map((mod, mi) => (
                  <div key={mi} className="rounded-lg border border-border bg-background">
                    <div className="flex items-center gap-2 p-2.5">
                      <BookOpen size={14} className="text-primary shrink-0" />
                      <input
                        value={mod.title}
                        onChange={e => updateModuleTitle(mi, e.target.value)}
                        className="flex-1 text-xs font-semibold bg-transparent border-none outline-none focus:bg-secondary/30 rounded px-1 -mx-1 transition-colors"
                      />
                      <span className="text-[10px] text-muted-foreground shrink-0">{mod.lessons.length} aulas</span>
                      <button onClick={() => removeModule(mi)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Remover módulo">
                        <Trash2 size={10} />
                      </button>
                      <button
                        onClick={() => setExpandedMod(expandedMod === mi ? null : mi)}
                        className="p-0.5"
                      >
                        {expandedMod === mi ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                    </div>
                    {expandedMod === mi && (
                      <div className="border-t border-border p-2.5 space-y-1.5 bg-secondary/5">
                        {mod.lessons.map((lesson, li) => (
                          <div key={li} className="rounded-md border border-border/50 bg-background p-2.5">
                            <div className="flex items-start gap-2">
                              <Play size={10} className="text-primary mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0 space-y-1">
                                <input
                                  value={lesson.title}
                                  onChange={e => updateLessonTitle(mi, li, e.target.value)}
                                  className="w-full text-[11px] font-semibold bg-transparent border-none outline-none focus:bg-secondary/30 rounded px-1 -mx-1 transition-colors"
                                />
                                <textarea
                                  value={lesson.description}
                                  onChange={e => updateLessonDesc(mi, li, e.target.value)}
                                  className="w-full text-[10px] text-muted-foreground bg-transparent border-none outline-none focus:bg-secondary/30 rounded px-1 -mx-1 resize-none transition-colors"
                                  rows={2}
                                />
                                <div className="bg-primary/5 rounded-md p-2 flex gap-1.5">
                                  <Lightbulb size={10} className="text-primary shrink-0 mt-0.5" />
                                  <p className="text-[9px] text-muted-foreground leading-relaxed">{lesson.dica_gravacao}</p>
                                </div>
                              </div>
                              <button onClick={() => removeLesson(mi, li)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0" title="Remover aula">
                                <Trash2 size={9} />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button onClick={() => addLesson(mi)} className="w-full flex items-center justify-center gap-1 text-[10px] text-primary hover:bg-primary/5 rounded-md py-1.5 transition-colors">
                          <Plus size={10} /> Adicionar Aula
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={addModule} className="w-full flex items-center justify-center gap-1 text-[10px] text-primary hover:bg-primary/5 rounded-lg border border-dashed border-primary/30 py-2 transition-colors">
                  <Plus size={10} /> Adicionar Módulo
                </button>
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={handleGenerate} disabled={generating} className="flex-1 gap-1.5 text-xs">
                <RefreshCw size={12} className={generating ? "animate-spin" : ""} /> Gerar Outra
              </Button>
              <Button onClick={handleCreate} disabled={creating} className="flex-1 gap-1.5 text-xs">
                {creating ? <><Loader2 size={12} className="animate-spin" /> Criando...</> : <><Check size={12} /> Aceitar e Criar</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Add Course Dialog ──
function AddCourseDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    // Auto-fetch first Pexels image as cover
    const covers = await searchPexelCovers(title);
    const cover = covers.length > 0 ? covers[0].url : null;
    const { error } = await supabase.from("training_courses").insert({
      title: title.trim(), description, target_role: targetRole, cover_url: cover,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao criar curso"); return; }
    toast.success("Curso criado!");
    setOpen(false); setTitle(""); setDescription("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="text-xs gap-1.5"><Plus size={14} /> Novo Curso</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Curso</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder="Título do curso" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          <Select value={targetRole} onValueChange={setTargetRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sdr">Apenas SDR</SelectItem>
              <SelectItem value="closer">Apenas Closer</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Sparkles size={10} /> Capa gerada automaticamente via Pexels</p>
          <Button onClick={handleSave} disabled={saving || !title.trim()} className="w-full">
            {saving ? <><Loader2 size={14} className="animate-spin mr-1" /> Criando...</> : "Criar Curso"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Course Dialog ──
function EditCourseDialog({ course, onSaved }: { course: Course; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [targetRole, setTargetRole] = useState(course.target_role);
  const [active, setActive] = useState(course.active);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const updates: any = { title, description, target_role: targetRole, active };
    const { error } = await supabase.from("training_courses").update(updates).eq("id", course.id);
    setSaving(false);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Curso atualizado!");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button onClick={e => e.stopPropagation()} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Edit2 size={12} /></button>
      </DialogTrigger>
      <DialogContent onClick={e => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Editar Curso</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          <Select value={targetRole} onValueChange={setTargetRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sdr">Apenas SDR</SelectItem>
              <SelectItem value="closer">Apenas Closer</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" />
            Curso ativo
          </label>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Module Dialog ──
function AddModuleDialog({ courseId, onSaved }: { courseId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("training_modules").insert({ course_id: courseId, title: title.trim() });
    setSaving(false);
    if (error) { toast.error("Erro ao criar módulo"); return; }
    toast.success("Módulo criado!");
    setOpen(false); setTitle("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1"><Plus size={10} /> Módulo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Módulo</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder="Nome do módulo" value={title} onChange={e => setTitle(e.target.value)} />
          <Button onClick={handleSave} disabled={saving || !title.trim()} className="w-full">{saving ? "Criando..." : "Criar Módulo"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── AI Lessons Generator Dialog ──
function AiLessonsDialog({ moduleId, moduleTitle, courseTitle, existingLessons, onSaved }: {
  moduleId: string; moduleTitle: string; courseTitle: string; existingLessons: Lesson[]; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lessons, setLessons] = useState<{ title: string; description: string; dica_gravacao: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [count, setCount] = useState("3");

  const handleGenerate = async () => {
    setGenerating(true);
    setLessons([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lessons", {
        body: {
          moduleTitle,
          courseTitle,
          existingLessons: existingLessons.map(l => l.title),
          count: parseInt(count),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLessons(data.lessons || []);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar aulas");
    }
    setGenerating(false);
  };

  const handleCreate = async () => {
    if (lessons.length === 0) return;
    setCreating(true);
    try {
      const startOrder = existingLessons.length;
      const inserts = await Promise.all(lessons.map(async (l, i) => {
        const covers = await searchPexelCovers(l.title);
        return {
          module_id: moduleId,
          title: l.title,
          description: `${l.description}\n\n💡 Dica de gravação: ${l.dica_gravacao}`,
          video_url: "",
          video_type: "youtube" as const,
          sort_order: startOrder + i,
          cover_url: covers.length > 0 ? covers[0].url : null,
        };
      }));
      const { error } = await supabase.from("training_lessons").insert(inserts);
      if (error) throw error;
      toast.success(`${lessons.length} aulas criadas! Adicione os vídeos.`);
      setOpen(false);
      setLessons([]);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar aulas");
    }
    setCreating(false);
  };

  const updateTitle = (i: number, val: string) => setLessons(l => l.map((x, j) => j === i ? { ...x, title: val } : x));
  const updateDesc = (i: number, val: string) => setLessons(l => l.map((x, j) => j === i ? { ...x, description: val } : x));
  const removeLesson = (i: number) => setLessons(l => l.filter((_, j) => j !== i));

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setLessons([]); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 border-primary/30 text-primary hover:bg-primary/10">
          <Wand2 size={10} /> IA Aulas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Wand2 size={16} className="text-primary" /> Gerar Aulas — {moduleTitle}
          </DialogTitle>
        </DialogHeader>

        {lessons.length === 0 ? (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              A IA vai gerar aulas para o módulo "<span className="font-semibold text-foreground">{moduleTitle}</span>"
              {existingLessons.length > 0 && ` (já tem ${existingLessons.length} aulas)`}.
            </p>
            <div>
              <label className="text-xs font-medium mb-1 block">Quantas aulas gerar?</label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2 text-xs">
              {generating ? <><Loader2 size={12} className="animate-spin" /> Gerando...</> : <><Wand2 size={12} /> Gerar Aulas</>}
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3 pt-2">
            <ScrollArea className="flex-1 max-h-[400px]">
              <div className="space-y-2 pr-3">
                {lessons.map((lesson, i) => (
                  <div key={i} className="rounded-md border border-border bg-background p-2.5">
                    <div className="flex items-start gap-2">
                      <Play size={10} className="text-primary mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <input
                          value={lesson.title}
                          onChange={e => updateTitle(i, e.target.value)}
                          className="w-full text-[11px] font-semibold bg-transparent border-none outline-none focus:bg-secondary/30 rounded px-1 -mx-1 transition-colors"
                        />
                        <textarea
                          value={lesson.description}
                          onChange={e => updateDesc(i, e.target.value)}
                          className="w-full text-[10px] text-muted-foreground bg-transparent border-none outline-none focus:bg-secondary/30 rounded px-1 -mx-1 resize-none transition-colors"
                          rows={2}
                        />
                        <div className="bg-primary/5 rounded-md p-2 flex gap-1.5">
                          <Lightbulb size={10} className="text-primary shrink-0 mt-0.5" />
                          <p className="text-[9px] text-muted-foreground leading-relaxed">{lesson.dica_gravacao}</p>
                        </div>
                      </div>
                      <button onClick={() => removeLesson(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <Trash2 size={9} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={handleGenerate} disabled={generating} className="flex-1 gap-1.5 text-xs">
                <RefreshCw size={12} className={generating ? "animate-spin" : ""} /> Gerar Outras
              </Button>
              <Button onClick={handleCreate} disabled={creating} className="flex-1 gap-1.5 text-xs">
                {creating ? <><Loader2 size={12} className="animate-spin" /> Criando...</> : <><Check size={12} /> Criar {lessons.length} Aulas</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Add Lesson Dialog ──
function AddLessonDialog({ moduleId, onSaved }: { moduleId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoType, setVideoType] = useState("youtube");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !videoUrl.trim()) return;
    setSaving(true);
    const covers = await searchPexelCovers(title);
    const cover = covers.length > 0 ? covers[0].url : null;
    const { error } = await supabase.from("training_lessons").insert({
      module_id: moduleId, title: title.trim(), video_url: videoUrl.trim(),
      video_type: videoType, cover_url: cover,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao criar aula"); return; }
    toast.success("Aula criada!");
    setOpen(false); setTitle(""); setVideoUrl("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1"><Plus size={10} /> Aula</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Aula</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input placeholder="Título da aula" value={title} onChange={e => setTitle(e.target.value)} />
          <Select value={videoType} onValueChange={setVideoType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="drive">Google Drive</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Cole o link do vídeo" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Sparkles size={10} /> Capa gerada automaticamente via Pexels</p>
          <Button onClick={handleSave} disabled={saving || !title.trim() || !videoUrl.trim()} className="w-full">
            {saving ? <><Loader2 size={14} className="animate-spin mr-1" /> Criando...</> : "Criar Aula"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Lesson Dialog ──
function EditLessonDialog({ lesson, onSaved }: { lesson: Lesson; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [videoUrl, setVideoUrl] = useState(lesson.video_url);
  const [videoType, setVideoType] = useState(lesson.video_type);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const updates: any = { title, video_url: videoUrl, video_type: videoType };
    const { error } = await supabase.from("training_lessons").update(updates).eq("id", lesson.id);
    setSaving(false);
    if (error) { toast.error("Erro"); return; }
    toast.success("Aula atualizada!");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1 rounded hover:bg-secondary text-muted-foreground"><Edit2 size={10} /></button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar Aula</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <Input value={title} onChange={e => setTitle(e.target.value)} />
          <Select value={videoType} onValueChange={setVideoType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="drive">Google Drive</SelectItem>
            </SelectContent>
          </Select>
          <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign Admin Select ──
function AssignAdminSelect({ lessonId, currentAdminId, teamMembers, onSaved }: {
  lessonId: string; currentAdminId: string | null; teamMembers: TeamMember[]; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleAssign = async (adminId: string) => {
    setSaving(true);
    const val = adminId === "none" ? null : adminId;
    const { error } = await supabase.from("training_lessons").update({ assigned_admin_id: val } as any).eq("id", lessonId);
    setSaving(false);
    if (error) { toast.error("Erro ao vincular"); return; }
    toast.success(val ? "Responsável vinculado!" : "Responsável removido");
    onSaved();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="shrink-0" onClick={e => e.stopPropagation()}>
            <Select value={currentAdminId || "none"} onValueChange={handleAssign} disabled={saving}>
              <SelectTrigger className="h-6 w-6 p-0 border-none bg-transparent justify-center [&>svg]:hidden">
                <User size={10} className={currentAdminId ? "text-primary" : "text-muted-foreground"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none"><span className="text-xs text-muted-foreground">Sem responsável</span></SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="text-xs">{m.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">
          {currentAdminId ? `Responsável: ${teamMembers.find(m => m.id === currentAdminId)?.name || "?"}` : "Vincular responsável"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Send Scripts Button ──
function SendScriptsButton({ scope, courseTitle, moduleTitle, modules, lessons, teamMembers, whatsappContacts, profiles, assignedAdminId }: {
  scope: "course" | "module" | "lesson";
  courseTitle: string;
  moduleTitle?: string;
  modules?: Module[];
  lessons: Lesson[];
  teamMembers: TeamMember[];
  whatsappContacts: WhatsAppContact[];
  profiles: { id: string; team_member_id: string | null }[];
  assignedAdminId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(assignedAdminId || "");

  const getPhoneForMember = (memberId: string): string | null => {
    // 1. Direct match by team_member_id
    const directContact = whatsappContacts.find(c => c.team_member_id === memberId);
    if (directContact?.phone) return directContact.phone;
    // 2. Find via profile: team_member_id -> profile.id (user_id) -> whatsapp_contact.user_id
    const profile = profiles.find(p => p.team_member_id === memberId);
    if (profile) {
      const userContact = whatsappContacts.find(c => c.user_id === profile.id);
      if (userContact?.phone) return userContact.phone;
    }
    return null;
  };

  const buildDriveLink = (folderId?: string | null) => folderId ? `https://drive.google.com/drive/folders/${folderId}` : null;

  const buildScriptMessage = (lessonsToSend: Lesson[], modTitle?: string, modFolderId?: string | null): string => {
    const header = scope === "course"
      ? `📚 *ROTEIRO DE GRAVAÇÃO*\n📖 Curso: ${courseTitle}\n${"─".repeat(30)}`
      : scope === "module"
        ? `📚 *ROTEIRO DE GRAVAÇÃO*\n📖 Curso: ${courseTitle}\n📂 Módulo: ${moduleTitle || modTitle}\n${"─".repeat(30)}`
        : `📚 *ROTEIRO DE GRAVAÇÃO*\n📖 Curso: ${courseTitle}\n📂 Módulo: ${moduleTitle}\n${"─".repeat(30)}`;

    const lessonScripts = lessonsToSend.map((l, i) => {
      const driveLink = buildDriveLink(l.drive_folder_id);
      return `\n🎬 *Aula ${i + 1}: ${l.title}*\n${l.description || "Sem descrição"}${driveLink ? `\n📁 Envie o vídeo aqui: ${driveLink}` : ""}\n`;
    }).join("\n");

    const moduleDriveLink = buildDriveLink(modFolderId);
    const driveSection = moduleDriveLink ? `\n📁 *Pasta do módulo:* ${moduleDriveLink}\n` : "";

    return `${header}\n${lessonScripts}\n${driveSection}${"─".repeat(30)}\n✅ Grave e envie os vídeos nas pastas indicadas acima!`;
  };

  const handleSend = async () => {
    if (!selectedMemberId) { toast.error("Selecione um responsável"); return; }
    const phone = getPhoneForMember(selectedMemberId);
    if (!phone) { toast.error("Este membro não possui contato de WhatsApp cadastrado"); return; }

    setSending(true);
    try {
      if (scope === "course" && modules) {
        for (const mod of modules) {
          const modLessons = lessons.filter(l => l.module_id === mod.id);
          if (modLessons.length === 0) continue;
          const courseMsg = buildScriptMessage(modLessons, mod.title, mod.drive_folder_id);
          await supabase.functions.invoke("send-whatsapp", { body: { phone, message: courseMsg } });
          await new Promise(r => setTimeout(r, 1500));
        }
        toast.success("Roteiros do curso enviados por WhatsApp!");
      } else {
        const msg = buildScriptMessage(lessons);
        await supabase.functions.invoke("send-whatsapp", { body: { phone, message: msg } });
        toast.success(`Roteiro ${scope === "module" ? "do módulo" : "da aula"} enviado por WhatsApp!`);
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    }
    setSending(false);
  };

  const iconSize = scope === "lesson" ? 9 : scope === "module" ? 10 : 12;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          onClick={e => e.stopPropagation()}
          className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          title={`Enviar roteiro ${scope === "course" ? "do curso" : scope === "module" ? "do módulo" : "da aula"}`}
        >
          <MessageSquare size={iconSize} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md" onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageSquare size={16} className="text-primary" />
            Enviar Roteiro via WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs">
            {scope === "course" && `Enviar roteiros de todas as aulas do curso "${courseTitle}"`}
            {scope === "module" && `Enviar roteiros das aulas do módulo "${moduleTitle}"`}
            {scope === "lesson" && `Enviar roteiro da aula "${lessons[0]?.title}"`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium mb-1.5 block">Enviar para quem?</label>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
              <SelectContent>
                {teamMembers.map(m => {
                  const hasPhone = !!getPhoneForMember(m.id);
                  return (
                    <SelectItem key={m.id} value={m.id} disabled={!hasPhone}>
                      <span className="text-xs flex items-center gap-1.5">
                        {m.name}
                        {!hasPhone && <span className="text-destructive text-[9px]">(sem WhatsApp)</span>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          <div className="bg-secondary/50 rounded-lg p-3 max-h-48 overflow-y-auto">
            <p className="text-[9px] uppercase font-semibold text-muted-foreground mb-1">Prévia da mensagem</p>
            <pre className="text-[10px] text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {scope === "course" && modules
                ? `📚 Curso: ${courseTitle}\n${modules.length} módulos serão enviados em mensagens separadas`
                : buildScriptMessage(lessons)
              }
            </pre>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 text-xs">Cancelar</Button>
            <Button onClick={handleSend} disabled={sending || !selectedMemberId} className="flex-1 gap-1.5 text-xs">
              {sending ? <><Loader2 size={12} className="animate-spin" /> Enviando...</> : <><Send size={12} /> Enviar</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Button ──
function DeleteButton({ table, id, onDeleted, size = "md" }: { table: string; id: string; onDeleted: () => void; size?: "sm" | "md" }) {
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Excluir permanentemente?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Excluído!");
    onDeleted();
  };
  return (
    <button onClick={handleDelete} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
      <Trash2 size={size === "sm" ? 10 : 12} />
    </button>
  );
}

// ── Publish Button ──
function PublishButton({ course, onPublished }: { course: Course; onPublished: () => void }) {
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Publicar "${course.title}" para ${course.target_role === "all" ? "toda equipe" : course.target_role === "sdr" ? "SDRs" : "Closers"}?`)) return;
    setPublishing(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("training_courses").update({ published: true, published_at: now }).eq("id", course.id);
    if (error) { toast.error("Erro ao publicar"); setPublishing(false); return; }
    await supabase.from("training_notifications" as any).insert({
      course_id: course.id,
      target_role: course.target_role,
      title: `🎓 Novo Treinamento!`,
      message: `O curso "${course.title}" foi publicado. Acesse a aba Treinamentos para assistir!`,
    });
    toast.success("Curso publicado! A equipe será notificada.");
    setPublishing(false);
    onPublished();
  };

  return (
    <button
      onClick={handlePublish}
      disabled={publishing}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
      title="Publicar curso"
    >
      <Send size={10} /> {publishing ? "..." : "Publicar"}
    </button>
  );
}

// ── Unpublish Button ──
function UnpublishButton({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const handleUnpublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Despublicar este curso? Ele não será mais visível para a equipe.")) return;
    await supabase.from("training_courses").update({ published: false, published_at: null }).eq("id", courseId);
    toast.success("Curso despublicado");
    onDone();
  };

  return (
    <button
      onClick={handleUnpublish}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors"
      title="Despublicar"
    >
      <EyeOff size={10} /> Despublicar
    </button>
  );
}

// ── Google Drive: Create Folders ──
function DriveCreateFoldersButton({ courseId, courseTitle, onDone }: { courseId: string; courseTitle: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-training", {
        body: { action: "create_folders", courseId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.folders?.length || 0} pastas criadas no Google Drive!`);
      onDone();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("not_connected")) {
        toast.error("Conecte o Google Drive primeiro (botão no topo da página)");
      } else {
        toast.error("Erro ao criar pastas: " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Criar pastas no Google Drive"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <FolderPlus size={12} />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[10px]">
          Criar pastas no Drive para "{courseTitle}"
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Google Drive: Sync Videos ──
function DriveSyncButton({ courseId, courseTitle, onDone }: { courseId: string; courseTitle: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-training", {
        body: { action: "sync_videos", courseId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data.synced === 0) {
        toast.info("Nenhum vídeo novo encontrado nas pastas do Drive");
      } else {
        toast.success(`${data.synced} vídeo(s) sincronizado(s)!`);
      }
      onDone();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("not_connected")) {
        toast.error("Conecte o Google Drive primeiro (botão no topo da página)");
      } else {
        toast.error("Erro ao sincronizar: " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleSync}
            disabled={loading}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Sincronizar vídeos do Drive"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <HardDrive size={12} />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[10px]">
          Sincronizar vídeos do Drive para "{courseTitle}"
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Google Drive Connection Status ──
function DriveConnectionStatus() {
  const [connected, setConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const checkConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-training", {
        body: { action: "check_connection" },
      });
      if (!error && data?.connected) {
        setConnected(true);
        // Try to get email
        const { data: tokenData } = await supabase
          .from("google_drive_tokens" as any)
          .select("drive_email")
          .maybeSingle() as any;
        if (tokenData?.drive_email) setDriveEmail(tokenData.drive_email);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { checkConnection(); }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-auth");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank", "width=600,height=700");
        toast.info("Complete a autorização na janela do Google");
        const interval = setInterval(async () => {
          const { data: check } = await supabase
            .from("google_drive_tokens" as any)
            .select("drive_email")
            .maybeSingle() as any;
          if (check) {
            clearInterval(interval);
            setConnecting(false);
            setConnected(true);
            setDriveEmail(check?.drive_email || null);
            toast.success("Google Drive conectado! 🎉");
          }
        }, 3000);
        setTimeout(() => { clearInterval(interval); setConnecting(false); }, 120000);
      }
    } catch {
      toast.error("Erro ao conectar com Google Drive");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar o Google Drive?")) return;
    setDisconnecting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("google_drive_tokens" as any)
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      setConnected(false);
      setDriveEmail(null);
      toast.success("Google Drive desconectado");
    } catch {
      toast.error("Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) return null;

  if (connected) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-[9px] gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
          <HardDrive size={10} />
          {driveEmail ? `Drive: ${driveEmail}` : "Drive conectado"}
        </Badge>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="p-1 rounded hover:bg-secondary text-muted-foreground/50 hover:text-destructive transition-colors"
          title="Desconectar Google Drive"
        >
          {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
        </button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs gap-1.5"
      onClick={handleConnect}
      disabled={connecting}
    >
      {connecting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
      {connecting ? "Conectando..." : "Conectar Drive"}
    </Button>
  );
}
