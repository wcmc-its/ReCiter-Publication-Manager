import { useState } from 'react';

export const usePagination = (totalCount: number): [number, number, (page:number) => void, (count: string) => void] => {
  const [page, setPage] = useState<number>(1);
  const [count, setCount] = useState<number>(20);

  const handlePaginationUpdate = (page: number) => {
    setPage(page)
  }

  const handleCountUpdate = (count: string) => {
    if (count) {
      setPage(1);
      setCount(parseInt(count));
    }
  }

  return [count, page, handlePaginationUpdate, handleCountUpdate ];
}