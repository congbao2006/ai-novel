export type CurrentUser = {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
};

export type AuthenticatedSession = {
  readonly rawToken: string;
  readonly expiresAt: Date;
  readonly user: CurrentUser;
};

export type RegisterInput = {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
};

export type LoginInput = {
  readonly email: string;
  readonly password: string;
};
