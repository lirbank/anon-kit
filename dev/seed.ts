// Seed a PHI-shaped schema with synthetic data for exercising the strategies.
// Usage: bun run seed [patientCount]  (default 100)
//
// Creates:
//   patients   — name, email, phone, ssn, dob, zip (the PII/PHI columns)
//   encounters — patient_id FK (non-deferrable, the shape that breaks a naive
//                id rewrite), dates, free-text notes with embedded
//                SSN/email/phone so the scrub pass has something to catch

import postgres from "postgres";

const patientCount = Number(process.argv[2] ?? 100);
if (!Number.isInteger(patientCount) || patientCount < 1) {
  console.error(`Invalid patient count: ${process.argv[2]}`);
  process.exit(1);
}

const url = process.env.ANON_KIT_DATABASE_URL;
if (!url) {
  console.error("ANON_KIT_DATABASE_URL is not set (see .env.example)");
  process.exit(1);
}

const sql = postgres(url);

const firstNames = [
  "Alice",
  "Bob",
  "Carol",
  "David",
  "Erin",
  "Frank",
  "Grace",
  "Henry",
  "Iris",
  "Jack",
];

const lastNames = [
  "Smith",
  "Jones",
  "Garcia",
  "Kim",
  "Chen",
  "Patel",
  "Miller",
  "Davis",
  "Lopez",
  "Nguyen",
];

const complaints = [
  "chest pain",
  "migraine",
  "fractured wrist",
  "flu symptoms",
  "back pain",
  "annual checkup",
];

const pick = <T>(arr: T[], i: number) => arr[i % arr.length]!;
const rand = (n: number) => Math.floor(Math.random() * n);
const pad = (n: number, len: number) => String(n).padStart(len, "0");

type Patient = {
  patient_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  ssn: string;
  dob: string;
  zip: string;
};

type Encounter = {
  patient_id: string;
  admit_date: string;
  discharge_date: string;
  notes: string;
};

const patients: Patient[] = [];
const encounters: Encounter[] = [];

for (let i = 0; i < patientCount; i++) {
  const first = pick(firstNames, i);
  const last = pick(lastNames, rand(lastNames.length));
  const ssn = `${pad(rand(900) + 100, 3)}-${pad(rand(100), 2)}-${pad(rand(10000), 4)}`;
  const phone = `${pad(rand(800) + 200, 3)}-${pad(rand(1000), 3)}-${pad(rand(10000), 4)}`;
  const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`;
  const patient: Patient = {
    patient_id: `p-${pad(i + 1, 6)}`,
    first_name: first,
    last_name: last,
    email,
    phone,
    ssn,
    dob: `${1940 + rand(70)}-${pad(rand(12) + 1, 2)}-${pad(rand(28) + 1, 2)}`,
    zip: `${pad(rand(90000) + 10000, 5)}`,
  };
  patients.push(patient);

  // 1-3 encounters per patient, notes deliberately leak PII
  const n = rand(3) + 1;
  for (let j = 0; j < n; j++) {
    const year = 2023 + rand(3);
    const month = rand(12) + 1;
    const day = rand(27) + 1;
    encounters.push({
      patient_id: patient.patient_id,
      admit_date: `${year}-${pad(month, 2)}-${pad(day, 2)}`,
      discharge_date: `${year}-${pad(month, 2)}-${pad(day + 1, 2)}`,
      notes:
        `Patient ${first} ${last} presented with ${pick(complaints, rand(complaints.length))}. ` +
        `Contact at ${email} or ${phone}. SSN on file: ${ssn}.`,
    });
  }
}

console.log(
  `Seeding ${patients.length} patients, ${encounters.length} encounters...`,
);

await sql.begin(async (sql) => {
  await sql`DROP TABLE IF EXISTS encounters`;
  await sql`DROP TABLE IF EXISTS patients`;

  await sql`
    CREATE TABLE patients (
      patient_id text PRIMARY KEY,
      first_name text NOT NULL,
      last_name  text NOT NULL,
      email      text NOT NULL,
      phone      text NOT NULL,
      ssn        text NOT NULL,
      dob        date NOT NULL,
      zip        text NOT NULL
    )`;

  await sql`
    CREATE TABLE encounters (
      encounter_id   serial PRIMARY KEY,
      patient_id     text NOT NULL REFERENCES patients (patient_id),
      admit_date     date NOT NULL,
      discharge_date date NOT NULL,
      notes          text NOT NULL
    )`;

  const chunk = 1000;
  for (let i = 0; i < patients.length; i += chunk) {
    await sql`INSERT INTO patients ${sql(patients.slice(i, i + chunk))}`;
  }
  for (let i = 0; i < encounters.length; i += chunk) {
    await sql`INSERT INTO encounters ${sql(encounters.slice(i, i + chunk))}`;
  }
});

const counts = await sql<{ table: string; count: number }[]>`
  SELECT 'patients' AS table, count(*)::int AS count FROM patients
  UNION ALL
  SELECT 'encounters', count(*)::int FROM encounters`;
console.log("Done.", Object.fromEntries(counts.map((r) => [r.table, r.count])));

await sql.end();
