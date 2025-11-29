// Webpage Scanner Content Script
console.log("Content script loaded on", window.location.href);

// Function to scan the entire webpage
function scanWebpage() {
  const scanData = {
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString(),
    text: {
      allText: document.body.innerText || '',
      textLength: (document.body.innerText || '').length,
      wordCount: (document.body.innerText || '').trim().split(/\s+/).filter(word => word.length > 0).length,
    },
    images: [],
    links: [],
    metadata: {
      description: '',
      keywords: '',
      author: '',
      viewport: '',
    },
    structure: {
      headings: {
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('h2').length,
        h3: document.querySelectorAll('h3').length,
        h4: document.querySelectorAll('h4').length,
        h5: document.querySelectorAll('h5').length,
        h6: document.querySelectorAll('h6').length,
      },
      paragraphs: document.querySelectorAll('p').length,
      lists: document.querySelectorAll('ul, ol').length,
      forms: document.querySelectorAll('form').length,
      tables: document.querySelectorAll('table').length,
    },
    scripts: document.querySelectorAll('script').length,
    stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
    language: document.documentElement.lang || 'not specified',
  };

  // Extract images
  const images = document.querySelectorAll('img');
  images.forEach((img, index) => {
    if (index < 50) { // Limit to first 50 images to avoid huge payloads
      scanData.images.push({
        src: img.src || img.getAttribute('data-src') || '',
        alt: img.alt || '',
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
      });
    }
  });

  // Extract links
  const links = document.querySelectorAll('a[href]');
  links.forEach((link, index) => {
    if (index < 100) { // Limit to first 100 links
      scanData.links.push({
        href: link.href,
        text: link.innerText.trim().substring(0, 100) || '',
        isExternal: link.hostname !== window.location.hostname,
      });
    }
  });

  // Extract metadata
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    scanData.metadata.description = metaDescription.getAttribute('content') || '';
  }

  const metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords) {
    scanData.metadata.keywords = metaKeywords.getAttribute('content') || '';
  }

  const metaAuthor = document.querySelector('meta[name="author"]');
  if (metaAuthor) {
    scanData.metadata.author = metaAuthor.getAttribute('content') || '';
  }

  const metaViewport = document.querySelector('meta[name="viewport"]');
  if (metaViewport) {
    scanData.metadata.viewport = metaViewport.getAttribute('content') || '';
  }

  // Extract Open Graph and Twitter Card metadata
  const ogTags = {};
  document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
    const property = meta.getAttribute('property');
    const content = meta.getAttribute('content');
    if (property && content) {
      ogTags[property] = content;
    }
  });
  scanData.metadata.openGraph = ogTags;

  return scanData;
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanWebpage') {
    try {
      const scanData = scanWebpage();
      sendResponse({ success: true, data: scanData });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true; // Indicates we will send a response asynchronously
  }
});

// Auto-scan on page load (optional - can be removed if you only want manual scanning)
// You can comment this out if you prefer manual scanning only
window.addEventListener('load', () => {
  console.log('Page loaded, webpage scan ready');
});
