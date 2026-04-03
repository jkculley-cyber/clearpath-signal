export async function onRequest(context) {
  const url = new URL(context.request.url);
  const sub = url.searchParams.get('sub') || 'Teachers';
  const q = url.searchParams.get('q') || '';
  const sort = url.searchParams.get('sort') || 'new';
  const limit = url.searchParams.get('limit') || '5';

  const redditUrl = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(q)}&sort=${sort}&limit=${limit}&restrict_sr=on&t=year`;

  const res = await fetch(redditUrl, {
    headers: { 'User-Agent': 'SIGNAL/1.0 (clearpathedgroup.com)' },
  });

  const data = await res.text();

  return new Response(data, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=60',
    },
  });
}
