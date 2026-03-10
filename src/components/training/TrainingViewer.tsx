import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Play, BookOpen, ChevronLeft, BookMarked, Sparkles, ArrowRight, Video, FileText, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMemberRoles } from "@/lib/db";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlaybookViewerUser } from "./PlaybookViewerUser";
import { Badge } from "@/components/ui/badge";
import { ProcessesHub } from "./validated-processes/ProcessesHub";

interface TrainingViewerProps {
  memberRole: string;
  previewAll?: boolean;
}

type Course = { id: string; title: string; description: string; cover_url: string | null; target_role: string; active: boolean; sort_order: number; published: boolean };
type Module = { id: string; course_id: string; title: string; sort_order: number };
type Lesson = { id: string; module_id: string; title: string; description: string; video_url: string; video_type: string; cover_url: string | null; sort_order: number };

function extractEmbedUrl(url: string, type: string): string {
  if (!url) return "";
  if (type === "youtube") {
    let videoId = "";
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
      /(?:youtu\.be\/)([^?\s]+)/,
      /(?:youtube\.com\/embed\/)([^?\s]+)/,
      /(?:youtube\.com\/shorts\/)([^?\s]+)/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) { videoId = m[1]; break; }
    }
    if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    return url;
  }
  const driveMatch = url.match(/\/d\/([^/]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  return url;
}

type ViewMode = "home" | "courses" | "playbooks";

export function TrainingViewer({ memberRole, previewAll }: TrainingViewerProps) {
  const roles = getMemberRoles({ member_role: memberRole });
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const { data: courses = [] } = useQuery({
    queryKey: ["training-courses", previewAll],
    queryFn: async () => {
      let q = supabase.from("training_courses").select("*").eq("active", true);
      if (!previewAll) q = q.eq("published", true);
      const { data } = await q.order("sort_order");
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

  const { data: playbookCount = 0 } = useQuery({
    queryKey: ["playbook-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("training_playbooks")
        .select("*", { count: "exact", head: true })
        .eq("is_published", true);
      return count || 0;
    },
  });

  const visibleCourses = courses.filter(c =>
    c.target_role === "all" || roles.includes(c.target_role)
  );

  const totalLessons = visibleCourses.reduce((sum, course) => {
    const mods = modules.filter(m => m.course_id === course.id);
    return sum + mods.reduce((s, mod) => s + lessons.filter(l => l.module_id === mod.id).length, 0);
  }, 0);

  const courseModules = selectedCourse
    ? modules.filter(m => m.course_id === selectedCourse.id)
    : [];

  const courseLessons = courseModules.flatMap(mod =>
    lessons.filter(l => l.module_id === mod.id)
  );

  const currentLesson = courseLessons[currentLessonIdx];

  useEffect(() => {
    if (!currentLesson) return;
    const mod = courseModules.find(m =>
      lessons.some(l => l.module_id === m.id && l.id === currentLesson.id)
    );
    if (mod) setExpandedModules(prev => new Set(prev).add(mod.id));
  }, [currentLessonIdx, currentLesson]);

  useEffect(() => {
    if (selectedCourse) {
      const mods = modules.filter(m => m.course_id === selectedCourse.id);
      setExpandedModules(new Set(mods.map(m => m.id)));
    }
  }, [selectedCourse]);

  const selectLesson = (lessonId: string) => {
    const idx = courseLessons.findIndex(l => l.id === lessonId);
    if (idx >= 0) setCurrentLessonIdx(idx);
  };

  const toggleModule = (modId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(modId) ? next.delete(modId) : next.add(modId);
      return next;
    });
  };

  useEffect(() => {
    if (!selectedCourse) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (currentLessonIdx < courseLessons.length - 1) setCurrentLessonIdx(i => i + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (currentLessonIdx > 0) setCurrentLessonIdx(i => i - 1);
      }
      if (e.key === "Escape") setSelectedCourse(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedCourse, currentLessonIdx, courseLessons.length]);

  // ── HOME / Landing ──
  if (viewMode === "home" && !selectedCourse) {
    return (
      <div className="space-y-8">
        {/* Hero section */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-accent/5">
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--primary)) 1px, transparent 1px), radial-gradient(circle at 80% 20%, hsl(var(--accent)) 1px, transparent 1px)",
            backgroundSize: "60px 60px, 80px 80px"
          }} />
          
          <div className="relative p-6 sm:p-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-5">
              <Sparkles size={12} className="text-primary" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Central de Capacitação</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight">
              Desenvolva suas habilidades.<br />
              <span className="text-primary">Acelere seus resultados.</span>
            </h1>
            
            <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
              Acesse treinamentos em vídeo e playbooks estratégicos criados para transformar sua performance comercial.
            </p>
          </div>
        </div>

        {/* Two big CTA cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Video Courses Card */}
          <button
            onClick={() => setViewMode("courses")}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 text-left"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/50" />
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/15 transition-all duration-300">
                  <Video size={24} className="text-primary" />
                </div>
                <ArrowRight size={18} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 mt-2" />
              </div>
              
              <h2 className="text-lg font-extrabold text-foreground group-hover:text-primary transition-colors">
                Treinamentos em Vídeo
              </h2>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Aulas gravadas com estratégias práticas, técnicas de prospecção, negociação e fechamento para acelerar seus resultados.
              </p>
              
              <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border/50">
                <Badge variant="outline" className="text-[9px] gap-1">
                  <GraduationCap size={10} /> {visibleCourses.length} {visibleCourses.length === 1 ? "curso" : "cursos"}
                </Badge>
                <Badge variant="outline" className="text-[9px] gap-1">
                  <Play size={10} /> {totalLessons} {totalLessons === 1 ? "aula" : "aulas"}
                </Badge>
              </div>
            </div>
          </button>

          {/* Playbooks Card */}
          <button
            onClick={() => setViewMode("playbooks")}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card hover:border-chart-3/40 hover:shadow-xl hover:shadow-chart-3/5 transition-all duration-300 text-left"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-chart-3 via-chart-3/80 to-chart-3/50" />
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl bg-chart-3/10 border border-chart-3/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-chart-3/15 transition-all duration-300">
                  <FileText size={24} className="text-chart-3" />
                </div>
                <ArrowRight size={18} className="text-muted-foreground/30 group-hover:text-chart-3 group-hover:translate-x-1 transition-all duration-300 mt-2" />
              </div>
              
              <h2 className="text-lg font-extrabold text-foreground group-hover:text-chart-3 transition-colors">
                Playbooks & Guias
              </h2>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Guias estratégicos com scripts, checklists e processos detalhados gerados com IA para consulta rápida no dia a dia.
              </p>
              
              <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border/50">
                <Badge variant="outline" className="text-[9px] gap-1">
                  <BookMarked size={10} /> {playbookCount} {playbookCount === 1 ? "playbook" : "playbooks"}
                </Badge>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── Courses List ──
  if (viewMode === "courses" && !selectedCourse) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setViewMode("home")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Voltar à Central
        </button>

        <div className="flex items-center gap-2 mb-2">
          <GraduationCap size={18} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Treinamentos em Vídeo</h2>
          <Badge variant="outline" className="text-[9px]">{visibleCourses.length}</Badge>
        </div>

        {visibleCourses.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap size={36} className="text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">Nenhum treinamento disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleCourses.map((course) => {
              const courseModCount = modules.filter(m => m.course_id === course.id).length;
              const courseLessonCount = modules
                .filter(m => m.course_id === course.id)
                .reduce((sum, mod) => sum + lessons.filter(l => l.module_id === mod.id).length, 0);

              return (
                <button
                  key={course.id}
                  onClick={() => { setSelectedCourse(course); setCurrentLessonIdx(0); }}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card hover:border-primary/40 transition-all text-left"
                >
                  {course.cover_url ? (
                    <div className="relative h-36 overflow-hidden">
                      <img src={course.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-white font-bold text-sm drop-shadow-lg">{course.title}</p>
                        <p className="text-white/70 text-[10px] mt-0.5">{courseModCount} módulos · {courseLessonCount} aulas</p>
                      </div>
                      <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play size={14} className="text-primary-foreground ml-0.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 h-36 flex flex-col justify-end bg-gradient-to-br from-primary/5 to-primary/15">
                      <GraduationCap size={24} className="text-primary mb-2" />
                      <p className="font-bold text-sm">{course.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{courseModCount} módulos · {courseLessonCount} aulas</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Playbooks View ──
  if (viewMode === "playbooks" && !selectedCourse) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setViewMode("home")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Voltar à Central
        </button>
        <PlaybookViewerUser memberRole={memberRole} />
      </div>
    );
  }

  // ── Horizontal Player View (Udemy-style) ──
  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="h-12 border-b border-border bg-card flex items-center gap-3 px-4 shrink-0">
        <button
          onClick={() => setSelectedCourse(null)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
          <span className="text-xs font-medium">Voltar</span>
        </button>
        <div className="h-5 w-px bg-border" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground truncate">{selectedCourse?.title}</p>
        </div>
        <div className="text-[10px] text-muted-foreground shrink-0">
          {currentLessonIdx + 1} / {courseLessons.length} aulas
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col bg-black">
          {currentLesson ? (
            currentLesson.video_url ? (
              <div className="flex-1 flex items-center justify-center">
                <iframe
                  key={currentLesson.id}
                  src={extractEmbedUrl(currentLesson.video_url, currentLesson.video_type)}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  frameBorder="0"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/50">
                <Play size={40} className="text-white/20" />
                <p className="text-sm">Vídeo ainda não adicionado</p>
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/50 text-xs">
              Nenhuma aula neste curso
            </div>
          )}

          {currentLesson && (
            <div className="bg-card border-t border-border p-4">
              <h3 className="text-sm font-bold text-foreground">{currentLesson.title}</h3>
              {currentLesson.description && (
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                  {currentLesson.description}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="w-72 xl:w-80 border-l border-border bg-card flex flex-col shrink-0">
          <div className="p-3 border-b border-border">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Conteúdo do Curso</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {courseModules.map((mod) => {
                const modLessons = lessons.filter(l => l.module_id === mod.id);
                const isExpanded = expandedModules.has(mod.id);

                return (
                  <div key={mod.id} className="mb-1">
                    <button
                      onClick={() => toggleModule(mod.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                    >
                      <BookOpen size={13} className="text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground truncate">{mod.title}</p>
                        <p className="text-[9px] text-muted-foreground">{modLessons.length} aulas</p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="ml-2 pl-3 border-l border-border/50 space-y-0.5">
                        {modLessons.map((lesson) => {
                          const globalIdx = courseLessons.findIndex(l => l.id === lesson.id);
                          const isCurrent = globalIdx === currentLessonIdx;

                          return (
                            <button
                              key={lesson.id}
                              onClick={() => selectLesson(lesson.id)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all",
                                isCurrent
                                  ? "bg-primary/10 text-primary"
                                  : "text-foreground/60 hover:text-foreground hover:bg-secondary/30"
                              )}
                            >
                              <div className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold",
                                isCurrent
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground"
                              )}>
                                {globalIdx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-[10px] truncate", isCurrent ? "font-semibold" : "")}>
                                  {lesson.title}
                                </p>
                              </div>
                              {isCurrent && <Play size={10} className="text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border flex gap-2">
            <button
              onClick={() => currentLessonIdx > 0 && setCurrentLessonIdx(i => i - 1)}
              disabled={currentLessonIdx === 0}
              className="flex-1 py-2 rounded-lg text-[10px] font-semibold bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-30 transition-colors"
            >
              ← Anterior
            </button>
            <button
              onClick={() => currentLessonIdx < courseLessons.length - 1 && setCurrentLessonIdx(i => i + 1)}
              disabled={currentLessonIdx >= courseLessons.length - 1}
              className="flex-1 py-2 rounded-lg text-[10px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 transition-colors"
            >
              Próxima →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
