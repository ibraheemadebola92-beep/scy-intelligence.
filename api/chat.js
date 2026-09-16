export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'SCY AI is not configured yet.' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON request.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const message =
    typeof body?.message === 'string' ? body.message.trim() : '';

  const allowedModels = new Set([
    'inclusionai/ling-3.0-flash-fin:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
  ]);

  const model = allowedModels.has(body?.model)
    ? body.model
    : 'inclusionai/ling-3.0-flash-fin:free';

  if (!message) {
    return new Response(
      JSON.stringify({ error: 'Message is required.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (message.length > 4000) {
    return new Response(
      JSON.stringify({ error: 'Message is too long.' }),
      {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 25000);

  try {
    const upstream = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        signal: controller.signal,

        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            'https://scyintelligence-tech-solution.netlify.app',
          'X-OpenRouter-Title': 'SCY Intelligence',
        },

        body: JSON.stringify({
          model,

          messages: [
            {
              role: 'system',
              content:
                'You are SCY AI, the website assistant for SCY Intelligence. Be concise, professional, helpful, and accurate. SCY Intelligence provides AI video creation, AI image creation, website design and development, AI agents, automation, prompt engineering, branding and digital design. Founder: Ibraheem Adebola, Founder & AI Engineer. Contact: scyintelligence@gmail.com. Do not invent clients, testimonials, prices, statistics, certifications, or services not provided in this instruction. If a visitor wants to start a project, direct them to the contact section or scyintelligence@gmail.com.',
            },

            {
              role: 'user',
              content: message,
            },
          ],

          temperature: 0.7,
          max_tokens: 700,
        }),
      }
    );

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      console.error('OpenRouter error:', upstream.status, data);

      return new Response(
        JSON.stringify({
          error: 'The AI service is temporarily unavailable.',
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const reply = data?.choices?.[0]?.message?.content;

    if (typeof reply !== 'string' || !reply.trim()) {
      return new Response(
        JSON.stringify({
          error: 'The AI service returned an empty response.',
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        reply: reply.trim(),
        model,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('SCY AI function error:', error);

    const isTimeout = error?.name === 'AbortError';

    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'The AI request timed out.'
          : 'Unable to reach the AI service.',
      }),
      {
        status: 504,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}
