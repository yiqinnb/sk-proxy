export default {
  async fetch(request) {
    const target = new URL(request.url).searchParams.get('u');
    if (!target) return new Response('Missing URL', { status: 400 });

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': '*',
          'Access-Control-Allow-Headers': '*'
        }
      });
    }

    const res = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });

    const h = new Headers(res.headers);
    h.set('Access-Control-Allow-Origin', '*');
    h.delete('content-encoding');
    
    return new Response(res.body, { status: res.status, headers: h });
  }
}
