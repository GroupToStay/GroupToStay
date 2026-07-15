export type PublicHeaderVisibilityInput = {
  authLoading: boolean;
  rolesLoading: boolean;
  isAuthenticated: boolean;
  isOrganizer: boolean;
  isHotel: boolean;
  isAdmin: boolean;
};

export type PublicHeaderVisibility = {
  ready: boolean;
  showSignIn: boolean;
  showRegister: boolean;
  showCreateRequest: boolean;
};

export function getPublicHeaderVisibility({
  authLoading,
  rolesLoading,
  isAuthenticated,
  isOrganizer,
  isHotel,
  isAdmin,
}: PublicHeaderVisibilityInput): PublicHeaderVisibility {
  const ready = !authLoading && (!isAuthenticated || !rolesLoading);

  if (!ready) {
    return {
      ready: false,
      showSignIn: false,
      showRegister: false,
      showCreateRequest: false,
    };
  }

  if (!isAuthenticated) {
    return {
      ready: true,
      showSignIn: true,
      showRegister: true,
      showCreateRequest: true,
    };
  }

  return {
    ready: true,
    showSignIn: false,
    showRegister: false,
    showCreateRequest: isOrganizer && !isHotel && !isAdmin,
  };
}
