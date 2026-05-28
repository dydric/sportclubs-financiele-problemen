export default function autoLinkText(text) {
  if (!text) return "";

  // Auto-link URLs
  const linkedText = text.replace(
    /([A-Za-z]+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&~?\/.=]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Auto-link Twitter usernames
  const userLinkedText = linkedText.replace(
    /(@[A-Za-z0-9-_]+)/g,
    '<a href="https://twitter.com/$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Auto-link Twitter hashtags
  const hashtagLinkedText = userLinkedText.replace(
    /(#\w+)/g,
    '<a href="https://twitter.com/hashtag/$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  return hashtagLinkedText;
}
