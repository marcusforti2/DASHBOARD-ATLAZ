import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map Dripify CSV columns to our metric keys
const COLUMN_MAP: Record<string, string> = {
  "invites sent": "conexoes",
  "invites accepted": "conexoes_aceitas",
  "messaged": "abordagens",
  "inmailed": "inmail",
};

const MONTH_MAP: Record<string, string> = {
  "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
  "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
  "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
};

function parseDripifyDate(dateStr: string): string | null {
  // "Feb 26, 2026" → "2026-02-26"
  const match = dateStr.trim().replace(/"/g, "").match(/^(\w{3})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (!match) return null;
  const [, mon, day, year] = match;
  const mm = MONTH_MAP[mon];
  if (!mm) return null;
  return `${year}-${mm}-${day.padStart(2, "0")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(JSON.stringify({ error: "Arquivo não enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileName = file.name?.toLowerCase() || "";
    const fileType = file.type || "";
    const isCsv = fileName.endsWith(".csv") || fileType === "text/csv";

    if (isCsv) {
      // Direct CSV parsing - no AI needed
      const text = await file.text();
      const lines = text.split("\n").map(l => l.trim()).filter(l => l);

      if (lines.length < 2) {
        return new Response(JSON.stringify({ error: "Arquivo CSV vazio ou inválido", daily_data: [] }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Parse header
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, "").toLowerCase());
      console.log("CSV headers:", headers);

      // Map header indices to our metric keys
      const colMapping: { index: number; metric: string }[] = [];
      headers.forEach((h, i) => {
        if (COLUMN_MAP[h]) {
          colMapping.push({ index: i, metric: COLUMN_MAP[h] });
        }
      });

      if (colMapping.length === 0) {
        return new Response(JSON.stringify({
          error: "Não encontrei colunas do Dripify (Invites sent, Invites accepted, Messaged). Verifique o arquivo.",
          daily_data: [],
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Parse data rows
      const dailyData: { date: string; metrics: Record<string, number> }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Handle CSV with quoted fields containing commas
        const values: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const ch of line) {
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ""; continue; }
          current += ch;
        }
        values.push(current.trim());

        // Skip "Total:" row
        if (values[0]?.toLowerCase().startsWith("total")) continue;

        const date = parseDripifyDate(values[0]);
        if (!date) continue;

        const metrics: Record<string, number> = {};
        for (const { index, metric } of colMapping) {
          const val = parseInt(values[index] || "0", 10);
          metrics[metric] = isNaN(val) ? 0 : val;
        }

        dailyData.push({ date, metrics });
      }

      console.log(`Parsed ${dailyData.length} days from CSV`);

      return new Response(JSON.stringify({
        type: "daily_stats",
        daily_data: dailyData,
        total_days: dailyData.length,
        columns_found: colMapping.map(c => c.metric),
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For non-CSV files (PDF, images), use AI to extract
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...uint8));
    const mimeType = file.type || "application/octet-stream";

    const prompt = `Você é um parser de relatórios do Dripify (ferramenta de automação LinkedIn).

O arquivo contém estatísticas diárias do Dripify. Extraia os dados por dia.

Mapeamento de colunas:
- "Invites sent" → "conexoes"
- "Invites accepted" → "conexoes_aceitas"  
- "Messaged" → "abordagens"
- "InMailed" → "inmail"

Ignore a linha "Total:".

Responda APENAS com JSON válido:
{
  "type": "daily_stats",
  "daily_data": [
    { "date": "2026-02-26", "metrics": { "conexoes": 0, "conexoes_aceitas": 14, "abordagens": 33 } }
  ],
  "total_days": 7,
  "columns_found": ["conexoes", "conexoes_aceitas", "abordagens"]
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        }],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`AI error: ${aiResponse.status}`, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições. Tente novamente.", daily_data: [] }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error [${aiResponse.status}]`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("IA não conseguiu extrair dados. Tente um arquivo CSV.");

    const parsed = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro parse-dripify:", error);
    return new Response(
      JSON.stringify({ error: error.message, daily_data: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
