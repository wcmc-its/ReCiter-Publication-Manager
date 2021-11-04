import React from 'react';

export const ExpandNavContext = React.createContext({
  expand: true,
  updateExpand: () => {}
})