// Cards are separated by a 1px border, never a shadow. Only floating things (a success toast, a sticky search) use `float`.
export const elevation = {
  none: {},
  float: { boxShadow: '0 2px 8px rgba(43, 54, 49, 0.08)' },
} as const;
