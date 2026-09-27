#!/usr/bin/env python3
"""実機の E2E 検証。極小振幅のテスト音を afplay で鳴らし、SIGSTOP/SIGCONT で
「別アプリが一時停止・再開・シークした」状況を作り、アプリが実際に処理した
入力ピークと出力ピーク（コールバックごと）を CSV で受け取って判定する。

イヤホン利用を想定し、テスト音の振幅は 0.03 (-30 dBFS) に固定。システム音量は触らない。
使い方: python3 scripts/e2e_check.py [--app dist/PauseResumeAudioFade.app]
"""
import argparse
import csv
import math
import os
import signal
import struct
import subprocess
import sys
import tempfile
import time
import wave

AMP = 0.03
SR = 48000
SILENT = 1e-4


def make_tone(path, seconds=40):
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        chunk = 4800
        for start in range(0, seconds * SR, chunk):
            frames = bytearray()
            for i in range(start, start + chunk):
                v = int(AMP * 32767 * math.cos(2 * math.pi * 440 * i / SR))
                frames += struct.pack("<hh", v, v)
            w.writeframes(bytes(frames))


def scenario(tone, log):
    time.sleep(2.0)
    p = subprocess.Popen(["afplay", tone])
    log("play")
    time.sleep(3.0)
    p.send_signal(signal.SIGSTOP); log("pause")
    time.sleep(2.0)
    p.send_signal(signal.SIGCONT); log("resume")
    time.sleep(3.0)
    p.send_signal(signal.SIGSTOP); log("seek-gap start")
    time.sleep(0.12)
    p.send_signal(signal.SIGCONT); log("seek-gap end")
    time.sleep(3.0)
    p.kill()


def analyze(rows):
    """rows: (start_frame, frames, input_peak, output_peak) のコールバック列"""
    ok = True

    def report(name, cond, detail):
        nonlocal ok
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}: {detail}")
        ok = ok and cond

    # 入力の無音区間（ある程度長いもの）を抽出
    gaps, run_start = [], None
    for i, r in enumerate(rows):
        silent = r[2] < SILENT
        if silent and run_start is None:
            run_start = i
        if not silent and run_start is not None:
            gaps.append((run_start, i))
            run_start = None
    playing_from = next((i for i, r in enumerate(rows) if r[2] > SILENT), None)
    gaps = [g for g in gaps if playing_from is not None and g[0] > playing_from]
    print(f"検出した無音区間(再生開始後): {len(gaps)} 件")
    if len(gaps) < 2:
        report("無音区間の検出", False, "一時停止とシークの2件が必要")
        return False

    def ms(a, b):
        return (rows[b][0] - rows[a][0]) / SR * 1000

    for label, (s, e) in zip(["一時停止→再開", "シーク相当"], gaps[:2]):
        gap_ms = ms(s, e)
        print(f"- {label}: 無音 {gap_ms:.0f} ms")
        # 出力は 100ms 遅れる。無音開始の手前、まだ出力中の区間で下降しているか
        pre = [r[3] for r in rows[max(0, s - 12):s + 12]]
        steady = rows[max(0, s - 40)][3]
        report("定常時は素通し(出力=入力)", abs(steady - AMP) < 0.002, f"出力ピーク {steady:.4f}")
        fade = [r[3] for r in rows[s - 2:s + 12]]
        print("  出力ピーク/AMP:", " ".join(f"{v / AMP:.2f}" for v in pre))
        report("停止前に出力がフェードアウトしている", min(fade) < 0.15 * AMP and max(fade) > 0.9 * AMP,
               f"最小 {min(fade) / AMP:.2f} 最大 {max(fade) / AMP:.2f}")
        # 再開後の立ち上がり
        post = [r[3] for r in rows[e + 8:e + 8 + 40]]
        first_full = next((k for k, v in enumerate(post) if v > 0.95 * AMP), None)
        print("  再開後の出力ピーク/AMP:", " ".join(f"{v / AMP:.2f}" for v in post[:32]))
        if gap_ms > 250:
            report("再開時にフェードイン(先頭は小さい)", post[0] < 0.3 * AMP, f"先頭 {post[0] / AMP:.2f}")
            report("約300msで全開に到達", first_full is not None and 200 < first_full * 10.7 < 500,
                   f"到達まで約 {None if first_full is None else round(first_full * 10.7)} ms")
        else:
            report("シーク相当でもフェードイン", post[0] < 0.3 * AMP, f"先頭 {post[0] / AMP:.2f}")
    return ok


def analyze_probe(rows):
    """別プロセスのプローブが見た「本体の実際の出力」。停止前に減衰し、再開後に立ち上がるか"""
    ok = True

    def report(name, cond, detail):
        nonlocal ok
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}: {detail}")
        ok = ok and cond

    peaks = [r[2] for r in rows]
    start = next((i for i, v in enumerate(peaks) if v > SILENT), None)
    gaps, run = [], None
    for i, v in enumerate(peaks):
        if start is not None and i > start:
            if v < SILENT and run is None:
                run = i
            elif v >= SILENT and run is not None:
                gaps.append((run, i))
                run = None
    print(f"\n[probe] 本体の実出力で検出した無音区間: {len(gaps)} 件")
    if len(gaps) < 2:
        report("無音区間の検出", False, "2件必要")
        return False
    for label, (s, e) in zip(["一時停止→再開", "シーク相当"], gaps[:2]):
        before = [v / AMP for v in peaks[s - 14:s]]
        after = [v / AMP for v in peaks[e:e + 40]]
        print(f"- {label}: 実出力の無音 {(rows[e][0] - rows[s][0]) / SR * 1000:.0f} ms")
        print("  停止前:", " ".join(f"{v:.2f}" for v in before))
        print("  再開後:", " ".join(f"{v:.2f}" for v in after[:32]))
        report("停止前に滑らかに減衰", before[0] > 0.95 and before[-1] < 0.1 and
               all(b <= a + 0.03 for a, b in zip(before, before[1:])), f"{before[0]:.2f} → {before[-1]:.2f}")
        report("再開後に滑らかに立ち上がる", after[0] < 0.3 and max(after) > 0.95 and
               all(b >= a - 0.03 for a, b in zip(after, after[1:] )), f"{after[0]:.2f} → {max(after):.2f}")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", default="dist/Pause Resume Audio Fade.app")
    ap.add_argument("--normal", action="store_true",
                    help="CLI モードではなく通常起動（メニューバーアプリ本来の経路）を検証する。本体の出力はプローブだけで判定")
    args = ap.parse_args()

    tmp = tempfile.mkdtemp()
    tone = os.path.join(tmp, "tone.wav")
    csv_path = os.path.join(tmp, "env.csv")
    log_path = os.path.join(tmp, "app.log")
    make_tone(tone)

    t0 = time.time()

    def log(msg):
        print(f"[{time.time() - t0:5.2f}s] {msg}")

    duration = 16
    probe_csv = os.path.join(tmp, "probe.csv")
    if args.normal:
        subprocess.run(["open", "-n", args.app])
    else:
        subprocess.Popen(["open", "-W", "-n", "--stdout", log_path, "--stderr", log_path, args.app,
                          "--args", "--envelope", str(duration), csv_path])
    time.sleep(2.5)
    subprocess.Popen(["open", "-W", "-n", "--stdout", log_path + ".probe", "--stderr", log_path + ".probe", args.app,
                      "--args", "--probe", str(duration - 2), probe_csv])
    time.sleep(1.0)
    t0 = time.time()
    scenario(tone, log)
    time.sleep(max(0, duration + 3 - (time.time() - t0)))

    if args.normal:
        rows, passed = [], True
        subprocess.run(["pkill", "-f", f"{args.app}/Contents/MacOS"])
    elif not os.path.exists(csv_path):
        print("CSV が出力されていません。アプリのログ:")
        print(open(log_path).read() if os.path.exists(log_path) else "(なし)")
        sys.exit(2)

    if not args.normal:
        rows, pos = [], 0
        with open(csv_path) as f:
            for r in csv.DictReader(f):
                n = int(float(r["frames"]))
                rows.append((pos, n, float(r["input"]), float(r["output"])))
                pos += n
        print(f"コールバック {len(rows)} 件, 合計 {pos / SR:.1f}s")
        passed = analyze(rows)
    if os.path.exists(probe_csv):
        prows, ppos = [], 0
        with open(probe_csv) as f:
            for r in csv.DictReader(f):
                n = int(float(r["frames"]))
                prows.append((ppos, n, float(r["peak"])))
                ppos += n
        passed = analyze_probe(prows) and passed
    else:
        print("\n[probe] CSV がありません（プローブ起動失敗）")
        passed = False
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
