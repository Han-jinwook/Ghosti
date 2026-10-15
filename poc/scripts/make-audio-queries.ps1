# SaySee PoC - 음성 질의 WAV 생성 (Windows 내장 TTS)
# 출력: poc/audio_queries/{id}.wav  (16kHz, 16bit, mono — EmbeddingGemma 2 오디오 입력 규격)
# 한국어: Microsoft Heami / 영어: Microsoft Zira
# 주의: 합성 음성이라 실제 사람 목소리와는 다름. 실제 음성은 PoC 화면의 녹음 버튼으로 별도 측정.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $PSScriptRoot
$presets = Get-Content (Join-Path $root 'src\presets.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$outDir = Join-Path $root 'audio_queries'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$voices = @{ ko = 'Microsoft Heami Desktop'; en = 'Microsoft Zira Desktop' }

foreach ($p in $presets) {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SelectVoice($voices[$p.lang])
    $synth.Rate = 0
    $file = Join-Path $outDir "$($p.id).wav"
    $synth.SetOutputToWaveFile($file, $format)
    $synth.Speak($p.q)
    $synth.Dispose()
    Write-Host ("{0,-16} {1}" -f $p.id, $p.q)
}
Write-Host "완료: $($presets.Count)개 -> $outDir"
