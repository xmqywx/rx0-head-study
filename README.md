# RX-0 Unicorn 学习模型（纯代码）

个人学习用，不发布。RX-0 是万代/日升的设计；外形、配色凭记忆，非官方资料。

- 一个输入：NT-D 进度 d（0 独角兽模式 → 1 毁灭模式），分 5 段（躯干解锁、腿伸长、手臂、肩甲、头部 V 字天线）。
- 身高 19.7 m → 21.7 m（大腿 +0.5、小腿 +0.6、腰 +0.5、颈 +0.4），1/10 比例建模。
- `rx0-shared/kin.js` 变形模型，`mech.js` 几何（骨架 + 装甲 + 精神感应框架），`stage.js`，`console.js`，`schedule.js`，`film.js`，`live.js`，`score.py`。

```
SKILL=~/.claude/skills/teardown
node gen-timeline.mjs
node $SKILL/sims/build.mjs ./rx0-film ./rx0-live
node $SKILL/sims/capture.mjs rx0-film --size 1600x900 --dpr 1.2 --out teardown-out/rx0-silent.mp4
python3 $SKILL/run_sfx.py $PWD/rx0-shared/score.py
ffmpeg -y -i teardown-out/rx0-silent.mp4 -i teardown-out/rx0-score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart teardown-out/rx0-unicorn.mp4
```
