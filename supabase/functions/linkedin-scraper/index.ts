import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PILOTERR_BASE = "https://piloterr.com/api/v2/linkedin";

/**
 * Scrapes LinkedIn profile data via Piloterr API.
 * 
 * Input: { linkedin_url: string } or { query: string } (name + company search)
 * Returns: structured profile data (headline, company, location, summary, experience)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const PILOTERR_API_KEY = Deno.env.get("PILOTERR_API_KEY");
  if (!PILOTERR_API_KEY) {
    return new Response(JSON.stringify({ error: "PILOTERR_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { linkedin_url, query } = await req.json();

    if (!linkedin_url && !query) {
      return new Response(JSON.stringify({ error: "Provide linkedin_url or query" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let profileData: any = null;

    if (linkedin_url) {
      // Direct profile scraping
      const cleanUrl = linkedin_url.replace(/\/$/, "").split("?")[0];
      console.log("[linkedin-scraper] Scraping profile:", cleanUrl);

      const resp = await fetch(`${PILOTERR_BASE}/profile`, {
        method: "GET",
        headers: {
          "x-api-key": PILOTERR_API_KEY,
          "Content-Type": "application/json",
        },
      });

      // Piloterr uses query params for the profile URL
      const profileResp = await fetch(`${PILOTERR_BASE}/profile?query=${encodeURIComponent(cleanUrl)}`, {
        headers: {
          "x-api-key": PILOTERR_API_KEY,
        },
      });

      if (!profileResp.ok) {
        const errText = await profileResp.text();
        console.error(`[linkedin-scraper] Piloterr error [${profileResp.status}]:`, errText);
        throw new Error(`Piloterr API error: ${profileResp.status}`);
      }

      profileData = await profileResp.json();
    } else if (query) {
      // Search by name
      console.log("[linkedin-scraper] Searching:", query);

      const searchResp = await fetch(`${PILOTERR_BASE}/search/people?query=${encodeURIComponent(query)}&limit=1`, {
        headers: {
          "x-api-key": PILOTERR_API_KEY,
        },
      });

      if (!searchResp.ok) {
        const errText = await searchResp.text();
        console.error(`[linkedin-scraper] Piloterr search error [${searchResp.status}]:`, errText);
        throw new Error(`Piloterr search error: ${searchResp.status}`);
      }

      const searchData = await searchResp.json();
      const results = searchData?.results || searchData?.data || [];
      
      if (results.length > 0) {
        profileData = results[0];
      }
    }

    if (!profileData) {
      return new Response(JSON.stringify({ found: false, profile: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize the data into a clean structure
    const normalized = {
      found: true,
      profile: {
        full_name: profileData.full_name || profileData.name || profileData.firstName + " " + (profileData.lastName || ""),
        headline: profileData.headline || profileData.title || "",
        location: profileData.location || profileData.city || "",
        company: profileData.company || profileData.current_company?.name || profileData.experience?.[0]?.company || "",
        company_role: profileData.occupation || profileData.current_company?.title || profileData.experience?.[0]?.title || "",
        industry: profileData.industry || profileData.current_company?.industry || "",
        summary: profileData.summary || profileData.about || "",
        connections: profileData.connections || profileData.follower_count || 0,
        experience: (profileData.experience || profileData.experiences || []).slice(0, 3).map((exp: any) => ({
          title: exp.title || exp.role || "",
          company: exp.company || exp.company_name || "",
          duration: exp.duration || exp.date_range || "",
        })),
        education: (profileData.education || []).slice(0, 2).map((edu: any) => ({
          school: edu.school || edu.institution || "",
          degree: edu.degree || edu.field_of_study || "",
        })),
        linkedin_url: linkedin_url || profileData.linkedin_url || profileData.url || "",
      },
    };

    console.log("[linkedin-scraper] Success:", normalized.profile.full_name, normalized.profile.company);

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[linkedin-scraper] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", found: false }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
