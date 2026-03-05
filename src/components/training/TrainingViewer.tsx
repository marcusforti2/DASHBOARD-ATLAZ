import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Play, ChevronUp, ChevronDown, BookOpen, X, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMemberRoles } from "@/lib/db";

interface TrainingViewerProps {
  memberRole: string;
  previewAll?: boolean;
}

type Course = { id: string; title: string; description: string; cover_url: string | null; target_role: string; active: boolean; sort_order: number; published: boolean };
type Module = { id: string; course_id: string; title: string; sort_order: number };
type Lesson = { id: string; module_id: string; title: string; description: string; video_url: string; video_type: string; cover_url: string | null; sort_order: number };

function extractEmbedUrl(url: string, type: string): string {
  if (type === "youtube") {
    // Handle various YouTube URL formats
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
  // Google Drive
  const driveMatch = url.match(/\/d\/([^/]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  return url;
}

export function TrainingViewer({ memberRole, previewAll }: TrainingViewerProps) {
  const roles = getMemberRoles({ member_role: memberRole });
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Filter courses by role
  const visibleCourses = courses.filter(c =>
    c.target_role === "all" || roles.includes(c.target_role)
  );

  // Get all lessons for selected course, flattened
  const courseLessons = selectedCourse
    ? modules
        .filter(m => m.course_id === selectedCourse.id)
        .flatMap(mod => lessons.filter(l => l.module_id === mod.id))
    : [];

  const currentLesson = courseLessons[currentLessonIdx];

  const goNext = useCallback(() => {
    if (currentLessonIdx < courseLessons.length - 1) setCurrentLessonIdx(i => i + 1);
  }, [currentLessonIdx, courseLessons.length]);

  const goPrev = useCallback(() => {
    if (currentLessonIdx > 0) setCurrentLessonIdx(i => i - 1);
  }, [currentLessonIdx]);

  // Swipe handling
  const touchStart = useRef<number>(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 60) { diff > 0 ? goNext() : goPrev(); }
  };

  // Keyboard
  useEffect(() => {
    if (!selectedCourse) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goNext();
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") setSelectedCourse(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedCourse, goNext, goPrev]);

  // ── Course List View ──
  if (!selectedCourse) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Treinamentos</h2>
        </div>

        {visibleCourses.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap size={36} className="text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">Nenhum treinamento disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div className="relative h-32 sm:h-40 overflow-hidden">
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
                    <div className="p-4 h-32 flex flex-col justify-end bg-gradient-to-br from-primary/5 to-primary/15">
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

  // ── TikTok-style Player View ──
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-3 sm:p-4 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-white/90 text-xs font-bold truncate">{selectedCourse.title}</p>
          <p className="text-white/50 text-[10px]">{currentLessonIdx + 1} / {courseLessons.length}</p>
        </div>
        <button
          onClick={() => setSelectedCourse(null)}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Video */}
      {currentLesson ? (
        <div className="flex-1 flex items-center justify-center">
          <iframe
            key={currentLesson.id}
            src={extractEmbedUrl(currentLesson.video_url, currentLesson.video_type)}
            className="w-full h-full max-w-[900px] max-h-[80vh]"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            frameBorder="0"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-white/50 text-xs">Nenhuma aula neste curso</div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-4">
        {currentLesson && (
          <div>
            <p className="text-white font-bold text-sm">{currentLesson.title}</p>
            {currentLesson.description && (
              <p className="text-white/60 text-[10px] mt-0.5 line-clamp-2">{currentLesson.description}</p>
            )}
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1 mt-3">
          {courseLessons.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentLessonIdx(i)}
              className={cn(
                "rounded-full transition-all",
                i === currentLessonIdx ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-white/30 hover:bg-white/50"
              )}
            />
          ))}
        </div>
      </div>

      {/* Side nav buttons */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        <button
          onClick={goPrev}
          disabled={currentLessonIdx === 0}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/20 transition-colors"
        >
          <ChevronUp size={18} />
        </button>
        <button
          onClick={goNext}
          disabled={currentLessonIdx >= courseLessons.length - 1}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/20 transition-colors"
        >
          <ChevronDown size={18} />
        </button>
      </div>
    </div>
  );
}
