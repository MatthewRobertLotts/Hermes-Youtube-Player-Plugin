export const ids = {
  video: 'dQw4w9WgXcQ',
  other: 'abcDEF12345',
  short: 'Sh0rtABC123',
  playlist: 'PLabc123',
};

export const mixedInitialData = {
  contents: [
    { richItemRenderer: { content: { videoRenderer: { videoId: ids.video, title: { runs: [{ text: 'Normal Video' }] }, lengthText: { simpleText: '3:33' }, thumbnail: { thumbnails: [{ url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg' }] } } } } },
    { unexpectedWrapper: [{ reelItemRenderer: { videoId: ids.short, headline: { simpleText: 'Short Fixture' } } }] },
    { lockupViewModel: { contentId: ids.playlist, contentType: 'PLAYLIST', metadata: { lockupMetadataViewModel: { title: { content: 'Playlist Fixture' } } } } },
    { unknownRenderer: { thing: true } },
  ],
};

export const partialInitialData = {
  one: [{ videoRenderer: { videoId: ids.other, title: { runs: [{ text: 'Partial Video' }] } } }],
  missing: [{ videoRenderer: { videoId: '', title: { simpleText: '' } } }, { strangeRenderer: { id: 'ignored' } }],
};

export const emptyInitialData = { contents: [{ unknownRenderer: { nested: [{ nope: true }] } }] };

export const malformedMetadata = {
  contents: [
    null,
    { videoRenderer: { videoId: ids.video, title: null, thumbnail: { broken: true } } },
    { lockupViewModel: { contentId: ids.other, metadata: {} } },
  ],
};
