export default {
  async fetch(request, env) {
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Kanso Bonsai is ready, but its static asset binding is unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};
