const ROLE_PERMISSIONS = {
  Admin: {
    dashboard: true,

    meetings: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },

    events: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },

    policies: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      history: true,
    },

    documents: {
      view: true,
      upload: true,
      delete: true,
    },

    activity: {
      view: true,
    },
  },

  Member: {
    dashboard: true,

    meetings: {
      view: true,
      create: true,
      edit: true,
      delete: false,
    },

    events: {
      view: true,
      create: true,
      edit: true,
      delete: false,
    },

    policies: {
      view: true,
      create: true,
      edit: true,
      delete: false,
      history: true,
    },

    documents: {
      view: true,
      upload: true,
      delete: false,
    },

    activity: {
      view: true,
    },
  },

  Viewer: {
    dashboard: true,

    meetings: {
      view: true,
      create: false,
      edit: false,
      delete: false,
    },

    events: {
      view: true,
      create: false,
      edit: false,
      delete: false,
    },

    policies: {
      view: true,
      create: false,
      edit: false,
      delete: false,
      history: true,
    },

    documents: {
      view: true,
      upload: false,
      delete: false,
    },

    activity: {
      view: false,
    },
  },
};

export function getPermissions(role) {
  return (
    ROLE_PERMISSIONS[role] ||
    ROLE_PERMISSIONS.Viewer
  );
}

export default ROLE_PERMISSIONS;