// Site-wide: send www to the apex domain and keep preview hosts out of search engines.
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname === 'www.whydrive.co.uk') {
    url.hostname = 'whydrive.co.uk';
    return Response.redirect(url.toString(), 301);
  }
  const response = await next();
  if (url.hostname.endsWith('.pages.dev')) {
    const r = new Response(response.body, response);
    r.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return r;
  }
  return response;
}
