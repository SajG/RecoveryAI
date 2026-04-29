import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production",
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const adminEmail = process.env.ADMIN_EMAIL?.trim();
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
        const adminPassword = process.env.ADMIN_PASSWORD?.trim();

        const email = credentials?.email?.trim() ?? "";
        const password = credentials?.password?.trim() ?? "";
        const isDev = process.env.NODE_ENV !== "production";

        if (!adminEmail || (!adminPasswordHash && !adminPassword) || !email || !password) {
          if (isDev) {
            console.warn("[auth] Missing login inputs or admin env.", JSON.stringify({
              hasAdminEmail: Boolean(adminEmail),
              hasAdminPasswordHash: Boolean(adminPasswordHash),
              hasAdminPassword: Boolean(adminPassword),
              hasEmail: Boolean(email),
              hasPassword: Boolean(password),
            }));
          }
          return null;
        }

        if (email.toLowerCase() !== adminEmail.toLowerCase()) {
          if (isDev) {
            console.warn("[auth] Email mismatch.", { inputEmail: email, adminEmail });
          }
          return null;
        }

        const isValidPassword = adminPasswordHash
          ? await compare(password, adminPasswordHash)
          : adminPassword === password;
        if (!isValidPassword) {
          if (isDev) {
            console.warn("[auth] Password hash mismatch for admin email.");
          }
          return null;
        }

        return {
          id: "admin",
          email: adminEmail,
          name: "Admin",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  logger: {
    error(code, metadata) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[next-auth][error]", code, metadata ?? "");
      }
    },
    warn(code) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[next-auth][warn]", code);
      }
    },
  },
  pages: {
    signIn: "/login",
  },
};
