/*
  Seeder for exercises table.
  Usage (PowerShell):
    node backend/scripts/seed_exercises.js
  Optionally set RAPIDAPI_KEY to fetch from ExerciseDB; otherwise use a small built-in seed.
*/
const fetch = global.fetch || require('node-fetch');
const db = require('../db');

async function seedFromRapidApi() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;
  const url = 'https://exercisedb.p.rapidapi.com/exercises?limit=200';
  const headers = {
    'x-rapidapi-key': key,
    'x-rapidapi-host': 'exercisedb.p.rapidapi.com'
  };
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`RapidAPI HTTP ${resp.status}`);
  const data = await resp.json();
  return data.map(e => ({
    exercise_name: e.name,
    target_muscle: e.target || e.bodyPart || '',
    equipment_needed: Array.isArray(e.equipment) ? e.equipment.join(', ') : (e.equipment || ''),
    instructions: e.instructions || '',
    media_url: e.gifUrl || ''
  }));
}

async function seedFallback() {
  return [
    { exercise_name: 'Push-Up', target_muscle: 'Chest', equipment_needed: 'Bodyweight', instructions: 'Keep body straight, lower until elbows at 90°, push back.', media_url: '' },
    { exercise_name: 'Bench Press', target_muscle: 'Chest', equipment_needed: 'Barbell', instructions: 'Lower bar to chest, press to full extension.', media_url: '' },
    { exercise_name: 'Dumbbell Fly', target_muscle: 'Chest', equipment_needed: 'Dumbbell', instructions: 'Open arms wide on bench, squeeze chest to raise.', media_url: '' },
    { exercise_name: 'Lat Pulldown', target_muscle: 'Back', equipment_needed: 'Machine', instructions: 'Pull bar to chest, squeeze lats.', media_url: '' },
    { exercise_name: 'Squat', target_muscle: 'Legs', equipment_needed: 'Barbell', instructions: 'Hinge at hips, sit down to parallel, stand up.', media_url: '' },
  ];
}

async function main() {
  let items = null;
  try {
    items = await seedFromRapidApi();
  } catch (e) {
    console.warn('RapidAPI fetch failed:', e.message);
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    items = await seedFallback();
  }

  await new Promise((resolve, reject) => {
    db.serialize(() => {
      const stmt = db.prepare(`INSERT INTO exercises (exercise_name, target_muscle, equipment_needed, instructions, media_url) VALUES (?, ?, ?, ?, ?)`);
      for (const it of items) {
        stmt.run([it.exercise_name, it.target_muscle, it.equipment_needed, it.instructions, it.media_url]);
      }
      stmt.finalize((err) => err ? reject(err) : resolve());
    });
  });
  console.log(`Seeded ${items.length} exercises`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
