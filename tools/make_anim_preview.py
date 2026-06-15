#!/usr/bin/env python3
"""추출된 idle 프레임들을 앱 화면에서 재생하는 애니 미리보기 HTML 생성."""
import base64
import sys

out_html = sys.argv[1]
frame_paths = sys.argv[2:]


def b64(p):
    with open(p, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()


uris = [b64(p) for p in frame_paths]
js_arr = ",".join(f'"{u}"' for u in uris)
# 호흡 시퀀스: 기본 → 찌부 → 기본 → 쭉  (4fps 느낌)
seq = "[0,1,0,2]"

statics = "".join(
    f'<div style="text-align:center"><img src="{u}" '
    f'style="width:128px;height:128px;image-rendering:pixelated;"/>'
    f'<div style="font-family:monospace;color:#93c5fd;font-size:12px;margin-top:4px">idle_{i}</div></div>'
    for i, u in enumerate(uris)
)

html = f"""<h2>실측 결과 — 나노바나나 + 추출기 파이프라인 ✅</h2>
<p class="subtitle">왼쪽은 실제 앱 화면(200×200, 슬라임 64px를 ×2=128px) 안에서 재생되는 idle 애니메이션. 오른쪽은 추출된 개별 프레임. 전부 나노바나나 1장 → 자동 추출 결과입니다.</p>

<div style="display:flex;gap:40px;align-items:center;flex-wrap:wrap;justify-content:center;margin-top:18px">

  <div style="text-align:center">
    <div style="width:200px;height:200px;border-radius:22px;
         background:rgba(186,230,253,0.9);box-shadow:0 8px 24px rgba(0,0,0,0.3);
         display:flex;align-items:flex-end;justify-content:center;padding-bottom:18px;">
      <img id="anim" style="width:128px;height:128px;image-rendering:pixelated;"/>
    </div>
    <div style="color:#94a3b8;font-size:12px;margin-top:8px">앱 안에서 재생 중 (호흡 루프)</div>
  </div>

  <div style="display:flex;gap:18px;align-items:flex-end">{statics}</div>

</div>

<p class="subtitle" style="margin-top:22px">결론: 이 워크플로우로 <b>나머지 9프레임(eat·happy·sad)</b>도 같은 방식으로 뽑으면 됩니다. 이 결과 괜찮으면 spec 문서로 넘어갈게요.</p>

<script>
  const frames = [{js_arr}];
  const seq = {seq};
  let i = 0;
  const el = document.getElementById('anim');
  function tick() {{ el.src = frames[seq[i % seq.length]]; i++; }}
  tick();
  setInterval(tick, 250);
</script>
"""

with open(out_html, "w") as f:
    f.write(html)
print("wrote", out_html)
