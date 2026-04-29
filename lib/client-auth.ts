import { apiPath } from "@/lib/client-api";

type CsrfResponse = {
  csrfToken?: string;
};

export async function signOutClient(callbackUrl = "/login"): Promise<void> {
  try {
    const csrfResponse = await fetch(apiPath("auth/csrf"), {
      cache: "no-store",
      credentials: "same-origin",
    });

    if (!csrfResponse.ok) {
      throw new Error("Failed to fetch CSRF token");
    }

    const csrfBody = (await csrfResponse.json()) as CsrfResponse;
    if (!csrfBody.csrfToken) {
      throw new Error("CSRF token missing");
    }

    const signOutBody = new URLSearchParams({
      csrfToken: csrfBody.csrfToken,
      callbackUrl,
      json: "true",
    });

    await fetch(apiPath("auth/signout"), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      credentials: "same-origin",
      body: signOutBody.toString(),
    });

    window.location.href = callbackUrl;
  } catch {
    // Last resort: go through the NextAuth signout endpoint.
    window.location.href = `${apiPath("auth/signout")}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }
}
