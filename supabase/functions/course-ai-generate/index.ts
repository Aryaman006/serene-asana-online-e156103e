import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { type, content, title } = await req.json();

    if (!content) {
      return new Response(JSON.stringify({ error: "Content is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip HTML for cleaner AI input
    const plainText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const truncated = plainText.slice(0, 4000);

    let systemPrompt = "";
    let tools: any[] = [];
    let toolChoice: any = undefined;

    if (type === "summary") {
      systemPrompt = "You are a content summarizer. Generate a concise 2-3 sentence summary of the given course content.";
      tools = [{
        type: "function",
        function: {
          name: "return_summary",
          description: "Return the generated summary",
          parameters: {
            type: "object",
            properties: { ai_summary: { type: "string", description: "2-3 sentence summary" } },
            required: ["ai_summary"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "return_summary" } };
    } else if (type === "seo") {
      systemPrompt = "You are an SEO expert. Generate SEO metadata for the given course content.";
      tools = [{
        type: "function",
        function: {
          name: "return_seo",
          description: "Return SEO metadata",
          parameters: {
            type: "object",
            properties: {
              seo_title: { type: "string", description: "SEO title under 60 chars" },
              seo_description: { type: "string", description: "Meta description under 160 chars" },
              seo_keywords: { type: "array", items: { type: "string" }, description: "5-8 SEO keywords" },
            },
            required: ["seo_title", "seo_description", "seo_keywords"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "return_seo" } };
    } else if (type === "tags") {
      systemPrompt = "You are a content tagger. Generate relevant tags for the given course content.";
      tools = [{
        type: "function",
        function: {
          name: "return_tags",
          description: "Return content tags",
          parameters: {
            type: "object",
            properties: { tags: { type: "array", items: { type: "string" }, description: "5-10 relevant tags" } },
            required: ["tags"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "return_tags" } };
    } else {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Title: ${title || "Untitled"}\n\nContent:\n${truncated}` },
        ],
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("course-ai-generate error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
