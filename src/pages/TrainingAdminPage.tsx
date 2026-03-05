import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, GraduationCap, BookOpen, Play, Trash2, Edit2, ChevronDown, ChevronRight,
  GripVertical, Video, Link2, Image, Send, Eye, EyeOff, Loader2, Sparkles
} from "lucide-react";

// ── Types ──
type Course = {
  id: string; title: string; description: string; cover_url: string | null;
  target_role: string; sort_order: number; active: boolean; created_at: string;
  published: boolean; published_at: string | null;
};
type Module = {
  id: string; course_id: string; title: string; description: string; sort_order: number;
};
type Lesson = {
  id: string; module_id: string; title: string; description: string;
  video_url: string; video_type: string; cover_url: string | null; sort_order: number;
};

// ── AI Cover generator ──
async function generateCoverAI(title: string, type: "course" | "lesson" = "course"): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-cover", {
      body: { title, type },
    });
    if (error || !data?.url) {
      console.error("Cover generation failed:", error || data);
      return null;
    }
    return data.url;
  } catch (e) {
    console.error("Cover generation error:", e);
    return null;
  }
}

export default function TrainingAdminPage() {
  const qc = useQueryClient();
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // ── Queries ──
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

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["training-courses"] });
    qc.invalidateQueries({ queryKey: ["training-modules"] });
    qc.invalidateQueries({ queryKey: ["training-lessons"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <GraduationCap size={20} className="text-primary" /> Treinamentos
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie cursos, módulos e aulas para sua equipe</p>
        </div>
        <AddCourseDialog onSaved={invalidateAll} />
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
                {/* Course header */}
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
                    {!course.published && (
                      <PublishButton course={course} onPublished={invalidateAll} />
                    )}
                    {course.published && (
                      <UnpublishButton courseId={course.id} onDone={invalidateAll} />
                    )}
                    <EditCourseDialog course={course} onSaved={invalidateAll} />
                    <DeleteButton table="training_courses" id={course.id} onDeleted={invalidateAll} />
                    {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                  </div>
                </div>

                {/* Modules */}
                {isExpanded && (
                  <div className="border-t border-border bg-secondary/10 p-3 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Módulos</p>
                      <AddModuleDialog courseId={course.id} onSaved={invalidateAll} />
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
                            <DeleteButton table="training_modules" id={mod.id} onDeleted={invalidateAll} size="sm" />
                            {modExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </div>

                          {modExpanded && (
                            <div className="border-t border-border p-2.5 space-y-1.5 bg-secondary/5">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wider">Aulas</p>
                                <AddLessonDialog moduleId={mod.id} onSaved={invalidateAll} />
                              </div>
                              {modLessons.length === 0 && (
                                <p className="text-[10px] text-muted-foreground/60 text-center py-2">Nenhuma aula</p>
                              )}
                              {modLessons.map((lesson) => (
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
                                    <p className="text-[9px] text-muted-foreground truncate flex items-center gap-1">
                                      <Video size={8} /> {lesson.video_type === "youtube" ? "YouTube" : "Drive"}
                                    </p>
                                  </div>
                                  <EditLessonDialog lesson={lesson} onSaved={invalidateAll} />
                                  <DeleteButton table="training_lessons" id={lesson.id} onDeleted={invalidateAll} size="sm" />
                                </div>
                              ))}
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
    const cover = await generateCoverAI(title, "course");
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
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Sparkles size={10} /> Capa gerada por IA automaticamente</p>
          <Button onClick={handleSave} disabled={saving || !title.trim()} className="w-full">
            {saving ? <><Loader2 size={14} className="animate-spin mr-1" /> Gerando capa...</> : "Criar Curso"}
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
    const coverChanged = title !== course.title;
    const updates: any = { title, description, target_role: targetRole, active };
    if (coverChanged) updates.cover_url = await generateCoverAI(title, "course");
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
    const cover = await generateCoverAI(title, "lesson");
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
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Sparkles size={10} /> Capa gerada por IA automaticamente</p>
          <Button onClick={handleSave} disabled={saving || !title.trim() || !videoUrl.trim()} className="w-full">
            {saving ? <><Loader2 size={14} className="animate-spin mr-1" /> Gerando capa...</> : "Criar Aula"}
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
    const coverChanged = title !== lesson.title;
    const updates: any = { title, video_url: videoUrl, video_type: videoType };
    if (coverChanged) updates.cover_url = await generateCoverAI(title, "lesson");
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
    // Create notification for team
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
