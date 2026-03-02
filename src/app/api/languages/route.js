export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const repos = await fetch("https://api.github.com/users/mikancel/repos", {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  if (!Array.isArray(repos)) return Response.json({});

  const totals = {};
  await Promise.all(repos.map(async (repo) => {
    const data = await fetch(repo.languages_url, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json());
    Object.entries(data).forEach(([lang, bytes]) => {
      totals[lang] = (totals[lang] || 0) + bytes;
    });
  }));

  return Response.json(totals);
}