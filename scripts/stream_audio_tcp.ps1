param(
  [string]$Server = "127.0.0.1",
  [int]$Port = 3001
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$binDir = Join-Path (Split-Path -Parent $scriptDir) "bin"

[System.Reflection.Assembly]::LoadFile((Join-Path $binDir "NAudio.Core.dll")) | Out-Null
[System.Reflection.Assembly]::LoadFile((Join-Path $binDir "NAudio.Wasapi.dll")) | Out-Null
[System.Reflection.Assembly]::LoadFile((Join-Path $binDir "NAudio.dll")) | Out-Null

$client = New-Object System.Net.Sockets.TcpClient
$client.Connect($Server, $Port)
$stream = $client.GetStream()

$capture = New-Object NAudio.Wave.WasapiLoopbackCapture

[Console]::Error.WriteLine("Capturando áudio do sistema: $($capture.WaveFormat.SampleRate)Hz, $($capture.WaveFormat.Channels) canais, $($capture.WaveFormat.BitsPerSample) bits")
[Console]::Error.Flush()

$action = {
    param($sender, $eventArgs)
    if ($eventArgs.BytesRecorded -gt 0) {
        try {
            $stream.Write($eventArgs.Buffer, 0, $eventArgs.BytesRecorded)
        } catch {
            [Environment]::Exit(0)
        }
    }
}

Register-ObjectEvent -InputObject $capture -EventName "DataAvailable" -Action $action | Out-Null

$capture.StartRecording()

try {
    while ($true) {
        Start-Sleep -Milliseconds 500
    }
} finally {
    $capture.StopRecording()
    $capture.Dispose()
    $stream.Close()
    $client.Close()
}
