export default {
  async fetch(request) {
    // 1. 解析目标 URL
    const target = new URL(request.url).searchParams.get('u');
    if (!target) {
      return new Response('Missing URL parameter "u"', { status: 400 });
    }

    // 2. 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': '*',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // 3. 构建转发请求头，清理可能导致目标服务器拒绝的标头
    const newHeaders = new Headers(request.headers);
    newHeaders.delete('host');
    newHeaders.delete('cf-connecting-ip');

    // 4. 向目标地址发起请求（跟随重定向）
    const res = await fetch(target, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: 'follow',
    });

    // 5. 处理响应头并返回
    const resHeaders = new Headers(res.headers);
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.delete('content-encoding');
    resHeaders.delete('content-security-policy');
    resHeaders.delete('x-frame-options');

    return new Response(res.body, {
      status: res.status,
      headers: resHeaders,
    });
  },
};
