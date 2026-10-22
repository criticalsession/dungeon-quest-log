"""Turn the screencast frames into a constant-frame-rate silent video (out/silent.mp4)."""
import json, subprocess, sys
from pathlib import Path
import imageio_ffmpeg

OUT = Path('out')
FF = imageio_ffmpeg.get_ffmpeg_exe()
frames = json.loads((OUT / 'frames.json').read_text())
events = json.loads((OUT / 'events.json').read_text())
end = next(e['t'] for e in events if e['type'] == 'end')
t0 = frames[0]['t']

lines = []
for i, f in enumerate(frames):
    nxt = frames[i + 1]['t'] if i + 1 < len(frames) else end
    dur = max(nxt - f['t'], 0.001)
    lines.append(f"file 'frames/{f['file']}'\nduration {dur:.4f}")
lines.append(f"file 'frames/{frames[-1]['file']}'")
(OUT / 'list.txt').write_text('\n'.join(lines))
(OUT / 'meta.json').write_text(json.dumps({'t0': t0, 'length': end - t0}))

subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(OUT / 'list.txt'),
                '-vf', 'fps=30,scale=in_range=pc:out_range=tv,format=yuv420p', '-pix_fmt', 'yuv420p',
                '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
                '-movflags', '+faststart', str(OUT / 'silent.mp4')], check=True)
print(f'length {end - t0:.1f} s')
