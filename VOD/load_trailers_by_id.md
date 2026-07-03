Esta api nos permite cargar los trailers y clips publicos/legales de las peliculas y series usando tan solo el id publico de imdb.
Usando el otro servicio mencionado y esta api podemos crear un estilo de netflix legal para ver todos los trailers.

funcionamiento de api (explicacion en codigo html):
<div class="endpoint-list reveal visible">

        <div class="endpoint-item active" onclick="selectEndpoint(this, 'ep1')">
          <button class="endpoint-trigger">
            <span class="method-badge">EMBED</span>
            <span class="endpoint-name">/embed/movie/{id}</span>
            <span class="endpoint-tag">Movie</span>
          </button>
          <div class="endpoint-body" id="ep1">
            <div class="code-block">
<span class="comment"># Movie Embed URL</span>
<br><span class="keyword">GET</span> https://vidsrc.mov/<span class="string">embed/movie/{id}</span>
<br><br><span class="comment"># IMDB example</span>
<br>https://vidsrc.mov/embed/movie/<span class="string">tt17048514</span>
<br><br><span class="comment"># TMDB example</span>
<br>https://vidsrc.mov/embed/movie/<span class="string">927085</span>
            </div>
          </div>
        </div>

        <div class="endpoint-item" onclick="selectEndpoint(this, 'ep2')">
          <button class="endpoint-trigger">
            <span class="method-badge">EMBED</span>
            <span class="endpoint-name">/embed/tv/{id}/{s}/{e}</span>
            <span class="endpoint-tag">TV Episode</span>
          </button>
          <div class="endpoint-body" id="ep2">
            <div class="code-block">
<span class="comment"># TV Episode Embed</span>
<br><span class="keyword">GET</span> https://vidsrc.mov/<span class="string">embed/tv/{id}/{season}/{ep}</span>
<br><br><span class="comment"># Example: Game of Thrones S1E5</span>
<br>https://vidsrc.mov/embed/tv/<span class="string">tt0944947/1/5</span>
            </div>
          </div>
        </div>

        <div class="endpoint-item" onclick="selectEndpoint(this, 'ep3')">
          <button class="endpoint-trigger">
            <span class="method-badge">API</span>
            <span class="endpoint-name">/vapi/movie/{type}/{page}</span>
            <span class="endpoint-tag">List</span>
          </button>
          <div class="endpoint-body" id="ep3">
            <div class="code-block">
<span class="comment"># List Latest / Recently Added Movies</span>
<br><span class="keyword">GET</span> https://vidsrc.mov/<span class="string">vapi/movie/new</span>
<br><span class="keyword">GET</span> https://vidsrc.mov/<span class="string">vapi/movie/add</span>
<br><br><span class="comment"># With pagination</span>
<br>https://vidsrc.mov/vapi/movie/<span class="string">new/15</span>
            </div>
          </div>
        </div>

        <div class="endpoint-item" onclick="selectEndpoint(this, 'ep4')">
          <button class="endpoint-trigger">
            <span class="method-badge">API</span>
            <span class="endpoint-name">/vapi/tv/{type}/{page}</span>
            <span class="endpoint-tag">List</span>
          </button>
          <div class="endpoint-body" id="ep4">
            <div class="code-block">
<span class="comment"># List Latest TV Shows</span>
<br><span class="keyword">GET</span> https://vidsrc.mov/<span class="string">vapi/tv/new</span>
<br><span class="keyword">GET</span> https://vidsrc.mov/<span class="string">vapi/tv/add/15</span>
<br><br><span class="comment"># Latest Episodes Feed</span>
<br>https://vidsrc.mov/<span class="string">vapi/episode/latest</span>
            </div>
          </div>
        </div>

        <div class="endpoint-item" onclick="selectEndpoint(this, 'ep5')">
          <button class="endpoint-trigger">
            <span class="method-badge">PARAM</span>
            <span class="endpoint-name">?sub.info={json}</span>
            <span class="endpoint-tag">Subtitles</span>
          </button>
          <div class="endpoint-body" id="ep5">
            <div class="code-block">
<span class="comment"># Custom subtitle injection</span>
<br>?<span class="keyword">sub.info</span>=<span class="string">{sub_json_url}</span>
<br><br><span class="comment"># JSON format:</span>
<br><span class="resp-punct">[</span>
<br>&nbsp; <span class="resp-punct">{</span> <span class="resp-key">"file"</span><span class="resp-punct">:</span> <span class="resp-str">"sub_en.vtt"</span><span class="resp-punct">,</span>
<br>&nbsp;&nbsp;&nbsp;<span class="resp-key">"label"</span><span class="resp-punct">:</span> <span class="resp-str">"English"</span> <span class="resp-punct">}</span>
<br><span class="resp-punct">]</span>
            </div>
          </div>
        </div>

      </div>