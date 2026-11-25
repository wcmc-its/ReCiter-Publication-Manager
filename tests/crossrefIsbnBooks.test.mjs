// Books in the Crossref Add-tab source: ISBN input and publisher as venue (src/utils/externalAddSearch.ts).
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIsbnInput, crossrefExternalArticleFrom, isBookType } from '../src/utils/externalAddSearch.ts'

test('normalizeIsbnInput: ISBN-10 and ISBN-13 forms all give the bare ISBN-13', () => {
    for (const q of ['1421455145', '1-4214-5514-5', '9781421455143', '978-1-4214-5514-3', ' ISBN 978 1 4214 5514 3 ', 'ISBN-13: 9781421455143'])
        assert.equal(normalizeIsbnInput(q), '9781421455143', q)
    assert.equal(normalizeIsbnInput('080442957X'), '9780804429573') // X check digit
    assert.equal(normalizeIsbnInput('080442957x'), '9780804429573')
})

test('normalizeIsbnInput: non-ISBNs stay null', () => {
    for (const q of ['1421455146', '9781421455144', '12345678', '41245678', '10.56021/9781421455143', 'Your Immune System', '', null, 9781421455143])
        assert.equal(normalizeIsbnInput(q), null, String(q))
})

test('crossrefExternalArticleFrom: a book with no container title uses its publisher as venue', () => {
    const book = { DOI: '10.56021/9781421455143', title: ['Your Immune System'], type: 'edited-book',
        publisher: 'Johns Hopkins University Press', author: [{ given: 'Gary Alan', family: 'Koretzky' }], published: { 'date-parts': [[2026]] } }
    const row = crossrefExternalArticleFrom(book)
    assert.equal(row.journalOrVenue, 'Johns Hopkins University Press')
    assert.equal(row.articleId, 'CROSSREF:10.56021/9781421455143')
    assert.equal(row.publicationType, 'edited-book')
    assert.equal(row.pubDate, '2026')
    // A chapter keeps its book (container title) as venue; an article never falls back to publisher.
    assert.equal(crossrefExternalArticleFrom({ ...book, type: 'book-chapter', 'container-title': ['The Book'] }).journalOrVenue, 'The Book')
    assert.equal(crossrefExternalArticleFrom({ ...book, type: 'journal-article' }).journalOrVenue, undefined)
    assert.equal(isBookType('book-chapter'), false)
})
