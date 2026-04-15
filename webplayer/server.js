const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const PROXY_HOST = process.env.PROXY_HOST || 'httproxy';
const PROXY_PORT = process.env.PROXY_PORT || '8888';
const HLS_DIR = '/tmp/hls';

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

const activeStreams = {};

setInterval(() => {
  const now = Date.now();
  for (const [id, stream] of Object.entries(activeStreams)) {
    if (now - stream.lastAccess > 120000) {
      console.log(`Stopping idle stream: ${id}`);
      stream.process.kill();
      fs.rmSync(stream.dir, { recursive: true, force: true });
      delete activeStreams[id];
    }
  }
}, 30000);

// Fetch raw M3U from httproxy
function fetchM3U() {
  return new Promise((resolve, reject) => {
    http.get(`http://${PROXY_HOST}:${PROXY_PORT}/aio`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Parse M3U and return structured JSON
// Handles #EXTGRP lines between #EXTINF and URL
app.get('/api/channels', async (req, res) => {
  try {
    const m3u = await fetchM3U();
    const lines = m3u.split('\n').map(l => l.trim()).filter(Boolean);
    const channels = [];

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#EXTINF')) continue;

      const infLine = lines[i];

      // Extract fields from #EXTINF
      const nameMatch = infLine.match(/,(.+)$/);
      const groupMatch = infLine.match(/group-title="([^"]*)"/);
      const logoMatch = infLine.match(/tvg-logo="([^"]*)"/);
      const tvgIdMatch = infLine.match(/tvg-id="([^"]*)"/);

      // Find next non-# line (the URL), skipping #EXTGRP etc.
      let url = null;
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        if (!lines[j].startsWith('#')) { url = lines[j]; break; }
      }

      if (!url || !nameMatch) continue;

      // Replace internal docker hostname with the server's own proxy
      // The stream endpoint will fetch server-side, so we just store the original URL
      // but rewrite httproxy -> PROXY_HOST (already correct for server-side fetch)
      channels.push({
        name: nameMatch[1].trim(),
        group: groupMatch ? groupMatch[1] : 'Sin grupo',
        logo: logoMatch ? logoMatch[1] : null,
        tvgId: tvgIdMatch ? tvgIdMatch[1] : null,
        // Encode original internal URL for use with /stream/:id endpoint
        streamId: Buffer.from(url).toString('base64')
      });
    }

    // Group channels
    const grouped = {};
    for (const ch of channels) {
      if (!grouped[ch.group]) grouped[ch.group] = [];
      grouped[ch.group].push(ch);
    }

    res.json({ channels, grouped, total: channels.length });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: e.message });
  }
});

// Start or reuse HLS stream
app.get('/stream/:channelId/index.m3u8', (req, res) => {
  const { channelId } = req.params;
  let channelUrl;
  try {
    channelUrl = Buffer.from(channelId, 'base64').toString('utf8');
  } catch {
    return res.status(400).send('Invalid channel ID');
  }

  const streamDir = path.join(HLS_DIR, channelId);
  const playlistPath = path.join(streamDir, 'index.m3u8');

  if (activeStreams[channelId]) {
    activeStreams[channelId].lastAccess = Date.now();
    waitForFile(playlistPath, 15000)
      .then(() => res.sendFile(playlistPath))
      .catch(() => res.status(504).send('Stream timeout'));
    return;
  }

  fs.mkdirSync(streamDir, { recursive: true });
  console.log(`Starting stream: ${channelUrl}`);

  const ffmpeg = spawn('ffmpeg', [
    '-re', '-i', channelUrl,
    '-c', 'copy',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '5',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', path.join(streamDir, 'seg%03d.ts'),
    playlistPath
  ]);

  ffmpeg.stderr.on('data', d => process.stdout.write(d));
  ffmpeg.on('exit', code => {
    console.log(`ffmpeg exit (${code}) for ${channelId}`);
    delete activeStreams[channelId];
  });

  activeStreams[channelId] = { process: ffmpeg, lastAccess: Date.now(), dir: streamDir };

  waitForFile(playlistPath, 15000)
    .then(() => res.sendFile(playlistPath))
    .catch(() => res.status(504).send('Stream timeout'));
});

app.get('/stream/:channelId/:segment', (req, res) => {
  const { channelId, segment } = req.params;
  if (activeStreams[channelId]) activeStreams[channelId].lastAccess = Date.now();
  res.sendFile(path.join(HLS_DIR, channelId, segment));
});

app.use(express.static(path.join(__dirname, 'public')));

function waitForFile(filePath, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (fs.existsSync(filePath)) return resolve();
      if (Date.now() - start > timeout) return reject();
      setTimeout(check, 500);
    };
    check();
  });
}

app.listen(8890, () => console.log('Webplayer on :8890'));