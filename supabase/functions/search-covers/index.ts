import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query, per_page = 8 } = await req.json();
    if (!query) throw new Error("Query is required");

    const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
    if (!PEXELS_API_KEY) throw new Error("PEXELS_API_KEY not set");

    // Translate query to English for better Pexels results
    let translatedQuery = query;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Translate the following text to English for use as a photo search query. Return ONLY the translated keywords, nothing else. If already in English, return as-is." },
              { role: "user", content: query },
            ],
            max_tokens: 50,
            temperature: 0,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const translated = aiData.choices?.[0]?.message?.content?.trim();
          if (translated) translatedQuery = translated;
        }
      } catch (e) {
        console.error("Translation fallback to original query:", e);
      }
    }

    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(translatedQuery)}&per_page=${per_page}&orientation=landscape`;
    
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_API_KEY },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Pexels API error:", errText);
      throw new Error(`Pexels API failed [${res.status}]`);
    }

    const data = await res.json();
    const images = (data.photos || []).map((p: any) => ({
      id: p.id,
      url: p.src.landscape, // 1200x627
      thumb: p.src.medium,  // 350x
      alt: p.alt || "",
      photographer: p.photographer,
    }));

    return new Response(JSON.stringify({ images }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
