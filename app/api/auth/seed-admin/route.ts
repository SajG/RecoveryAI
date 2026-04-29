import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is disabled in production." },
      { status: 403 }
    );
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Recovery Admin";

  if (!email || !password) {
    return NextResponse.json(
      { error: "ADMIN_EMAIL and ADMIN_PASSWORD are required." },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      name,
      role: "admin",
    },
    create: {
      email: email.toLowerCase(),
      name,
      role: "admin",
    },
  });

  return NextResponse.json({
    ok: true,
    email: email.toLowerCase(),
    adminPasswordHash: passwordHash,
    note: "Set ADMIN_PASSWORD_HASH in your .env.local to this value.",
  });
}
