// No external serve import needed - using Deno.serve

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const { imageUrl, removeBackground, mode } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'imageUrl is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let prompt: string;

    if (mode === 'process') {
      prompt = `You are a sticker designer agent. Take this photo of a business process/flowchart/diagram and transform it into a clean, visually appealing WhatsApp sticker.

Rules:
- Simplify the process into a clean, minimal infographic style
- Use bold icons and arrows to represent the flow
- Keep text very short (1-3 words per step max)
- Use vibrant colors with high contrast
- Make it square format, suitable as a WhatsApp sticker
- Add a slight white border/outline for sticker effect
- Output on a solid white background
- Make it look professional but fun — like a premium sticker`;
    } else if (removeBackground) {
      prompt = 'Remove the background from this image completely, making it transparent. Keep only the main subject/person/object. Output as a clean sticker-style cutout on a solid white background. Make sure it looks like a WhatsApp sticker.';
    } else {
      prompt = 'Convert this image into a fun WhatsApp-style sticker. Keep the original content but make it look like a sticker with slightly enhanced colors and contrast. Output on a solid white background.';
    }

    console.log(`[generate-sticker] Processing image, mode=${mode || 'default'}, removeBackground=${removeBackground}`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-image-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        modalities: ['image', 'text']
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[generate-sticker] AI error:', errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Tente novamente em alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes para IA.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedImage = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      console.error('[generate-sticker] No image in AI response');
      return new Response(JSON.stringify({ error: 'AI did not return an image', fallback: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[generate-sticker] Success, returning generated image');

    return new Response(JSON.stringify({ imageBase64: generatedImage }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[generate-sticker] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
