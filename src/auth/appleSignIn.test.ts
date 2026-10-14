import { afterEach, expect, it, vi } from "vitest";
import {
  createAppleNonce,
  signInWithAppleNative,
  AppleSignInCancelledError,
} from "./appleSignIn";

const { authorize, signInWithIdToken, updateUser, getUser, from } = vi.hoisted(
  () => ({
    authorize: vi.fn(),
    signInWithIdToken: vi.fn(),
    updateUser: vi.fn(),
    getUser: vi.fn(),
    from: vi.fn(),
  }),
);

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "ios" },
}));
vi.mock("@capacitor-community/apple-sign-in", () => ({
  SignInWithApple: { authorize },
}));
vi.mock("@/data/supabase/client", () => ({
  getSupabase: () => ({
    auth: { signInWithIdToken, updateUser, getUser },
    from,
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

it("creates a raw nonce and a distinct SHA-256 hex hash", async () => {
  const first = await createAppleNonce();
  const second = await createAppleNonce();
  expect(first.raw).toMatch(/^[0-9a-f]{64}$/);
  expect(first.hashed).toMatch(/^[0-9a-f]{64}$/);
  expect(first.raw).not.toBe(first.hashed);
  expect(first.raw).not.toBe(second.raw);
});

it("exchanges the Apple identity token with the raw nonce", async () => {
  authorize.mockResolvedValue({
    response: {
      user: "apple-sub",
      email: "hide@privaterelay.appleid.com",
      givenName: "Ada",
      familyName: "Lovelace",
      identityToken: "apple-id-token",
      authorizationCode: "code",
    },
  });
  signInWithIdToken.mockResolvedValue({ error: null });
  updateUser.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq });
  from.mockReturnValue({ update });

  await signInWithAppleNative();

  expect(authorize).toHaveBeenCalledWith({
    clientId: "app.dan.ios",
    redirectURI: "https://dan.pages.dev/login",
    scopes: "email name",
    nonce: expect.stringMatching(/^[0-9a-f]{64}$/),
  });
  expect(signInWithIdToken).toHaveBeenCalledWith({
    provider: "apple",
    token: "apple-id-token",
    nonce: expect.stringMatching(/^[0-9a-f]{64}$/),
  });
  const hashed = authorize.mock.calls[0]![0].nonce as string;
  const raw = signInWithIdToken.mock.calls[0]![0].nonce as string;
  expect(hashed).not.toBe(raw);
  expect(updateUser).toHaveBeenCalledWith({
    data: expect.objectContaining({ display_name: "Ada Lovelace" }),
  });
  expect(from).toHaveBeenCalledWith("profiles");
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ display_name: "Ada Lovelace" }),
  );
});

it("maps user cancellation to AppleSignInCancelledError", async () => {
  authorize.mockRejectedValue(
    Object.assign(new Error("cancelled"), { code: "USER_CANCELLED" }),
  );
  await expect(signInWithAppleNative()).rejects.toBeInstanceOf(
    AppleSignInCancelledError,
  );
  expect(signInWithIdToken).not.toHaveBeenCalled();
});
