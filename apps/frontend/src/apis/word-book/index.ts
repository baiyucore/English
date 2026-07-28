import type { WordQuery, WordList } from '@en/common/word';
import { serverApi, type Response } from '..';

export const getWordBookList = (
  params: WordQuery,
): Promise<Response<WordList>> => {
  return serverApi.get('/word-book', { params }) as Promise<Response<WordList>>;
};
