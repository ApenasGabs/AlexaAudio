param(
  [int]$SampleRate = 48000
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$binDir = Join-Path (Split-Path -Parent $scriptDir) "bin"

[System.Reflection.Assembly]::LoadFile((Join-Path $binDir "NAudio.Core.dll")) | Out-Null
[System.Reflection.Assembly]::LoadFile((Join-Path $binDir "NAudio.Wasapi.dll")) | Out-Null
[System.Reflection.Assembly]::LoadFile((Join-Path $binDir "NAudio.dll")) | Out-Null

$capture = New-Object NAudio.Wave.WasapiLoopbackCapture
$stdout = [System.Console]::OpenStandardOutput()

[Console]::Error.WriteLine("CHANNELS=$($capture.WaveFormat.Channels)")
[Console]::Error.WriteLine("SAMPLERATE=$($capture.WaveFormat.SampleRate)")
[Console]::Error.WriteLine("BITS=$($capture.WaveFormat.BitsPerSample)")
[Console]::Error.WriteLine("ENCODING=$($capture.WaveFormat.Encoding)")
[Console]::Error.Flush()

$action = {
    param($sender, $eventArgs)
    if ($eventArgs.BytesRecorded -gt 0) {
        try {
            $stdout.Write($eventArgs.Buffer, 0, $eventArgs.BytesRecorded)
            $stdout.Flush()
        } catch {
            [Environment]::Exit(0)
        }
    }
}

Register-ObjectEvent -InputObject $capture -EventName "DataAvailable" -Action $action | Out-Null

$capture.StartRecording()

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    $capture.StopRecording()
    $capture.Dispose()
}
