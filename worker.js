export default {
  async fetch(request) {
    const reqUrl = request.url;
    // 定义锚点，获取目标 URL 之后的所有内容
    const prefix = '?u=';
    const targetIndex = reqUrl.indexOf(prefix);
    
    // 1. 极致解析目标 URL（完美兼容未编码的复杂参数）
    let targetUrl = '';
    if (targetIndex !== -1) {
      // 截取 ?u= 后面的所有字符，并自动解码
      targetUrl = decodeURIComponent(reqUrl.slice(targetIndex + prefix.length));
    }

    if (!targetUrl) {
      return new Response('参数错误。请使用格式：https://你的域名/?u=目标网址', { status: 400 });
    }

    // 2. 处理浏览器的跨域预检请求 (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 3. 深度伪装：重写并清理请求头
    const newHeaders = new Headers(request.headers);
    // 删掉所有会暴露“这是从 Cloudflare 发出来的”特征头
    const headersToDelete = [
      'host',                // 必须删，否则目标服务器找不到对应站点
      'cf-connecting-ip',    // CF真实IP，不能露
      'cf-ray',              // CF请求ID，不能露
      'cf-visitor',          // CF协议信息
      'x-forwarded-for',     // 代理链IP，不能露
      'x-forwarded-proto',
      'x-real-ip',
      'connection',          // 避免长连接冲突
      'keep-alive',
      'transfer-encoding'
    ];
    headersToDelete.forEach(h => newHeaders.delete(h));

    // 4. 组装请求配置
    const fetchOptions = {
      method: request.method,
      headers: newHeaders,
      redirect: 'follow', // 自动跟随目标服务器的重定向
    };

    // 5. 完美流转 Body（针对 POST/PUT/PATCH）
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      // 使用 duplex: 'half' 进行流式转发，防止大文件或复杂 JSON 解析失败
      fetchOptions.body = request.body;
      fetchOptions.duplex = 'half'; 
    }

    try {
      // 6. 发起核心请求：用 CF 的 IP 去打目标系统
      const response = await fetch(targetUrl, fetchOptions);

      // 7. 洗白响应头，并注入跨域权限
      const resHeaders = new Headers(response.headers);
      
      // 强行允许你的本地程序或网页读取数据
      resHeaders.set('Access-Control-Allow-Origin', '*');
      resHeaders.set('Access-Control-Expose-Headers', '*');
      
      // 极其重要：必须删掉压缩和长度头，因为 CF 底层已自动解压，不删会导致你拿到乱码
      resHeaders.delete('content-encoding');
      resHeaders.delete('content-length');
      resHeaders.delete('transfer-encoding');

      // 8. 原样返回目标服务器的数据
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders,
      });

    } catch (error) {
      // 错误兜底：如果目标系统把 CF 的 IP 也封了，或者网络超时
      return new Response(JSON.stringify({
        status: "error",
        message: "Worker 请求目标系统失败",
        detail: error.message,
        target_url_attempted: targetUrl
      }), { 
        status: 502, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        } 
      });
    }
  },
};
