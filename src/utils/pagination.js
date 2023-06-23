export const getOffset = (page, count) => {
  const offset = (page - 1) * count;
  return offset;
}