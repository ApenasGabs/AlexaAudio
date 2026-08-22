param(
  [string]$Server = "127.0.0.1",
  [int]$Port = 3001
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

$binDir = Join-Path (Split-Path -Parent $scriptDir) "bin"
$naudioDll = Join-Path $binDir "NAudio.dll"

if (-not (Test-Path $naudioDll)) {
    $binDir = Join-Path $scriptDir "bin"
    $naudioDll = Join-Path $binDir "NAudio.dll"
}

[System.Reflection.Assembly]::LoadFrom($naudioDll) | Out-Null

$source = @"
using System;
using System.Net.Sockets;
using System.Threading;
using NAudio.Wave;

public class WasapiStreamer
{
    private static TcpClient client;
    private static NetworkStream stream;
    private static WasapiLoopbackCapture capture;
    private static long lastDataTicks = 0;
    private static bool isRunning = true;
    private static readonly object streamLock = new object();

    public static void Start(string host, int port)
    {
        try
        {
            client = new TcpClient();
            client.NoDelay = true;
            client.Connect(host, port);
            stream = client.GetStream();

            capture = new WasapiLoopbackCapture();

            Console.Error.WriteLine(string.Format("WASAPI: SAMPLERATE={0}, CHANNELS={1}, BITS={2}", 
                capture.WaveFormat.SampleRate, capture.WaveFormat.Channels, capture.WaveFormat.BitsPerSample));
            Console.Error.Flush();

            lastDataTicks = DateTime.UtcNow.Ticks;

            capture.DataAvailable += (s, e) =>
            {
                if (e.BytesRecorded > 0)
                {
                    try
                    {
                        lock (streamLock)
                        {
                            stream.Write(e.Buffer, 0, e.BytesRecorded);
                        }
                        Interlocked.Exchange(ref lastDataTicks, DateTime.UtcNow.Ticks);
                    }
                    catch (Exception)
                    {
                        Environment.Exit(0);
                    }
                }
            };

            capture.RecordingStopped += (s, e) =>
            {
                Environment.Exit(0);
            };

            capture.StartRecording();

            // Gera silêncio estritamente a 48kHz estéreo float32 (20ms = 7680 bytes)
            int silenceBytes = (int)(capture.WaveFormat.SampleRate * capture.WaveFormat.Channels * (capture.WaveFormat.BitsPerSample / 8) * 0.02);
            byte[] silenceBuffer = new byte[silenceBytes];

            var silenceThread = new Thread(() =>
            {
                while (isRunning)
                {
                    Thread.Sleep(20);
                    long last = Interlocked.Read(ref lastDataTicks);
                    long diffMs = (DateTime.UtcNow.Ticks - last) / TimeSpan.TicksPerMillisecond;

                    // Se não houver som do Windows por mais de 80ms, envia silêncio sincronizado
                    if (diffMs > 80)
                    {
                        try
                        {
                            lock (streamLock)
                            {
                                stream.Write(silenceBuffer, 0, silenceBuffer.Length);
                            }
                        }
                        catch (Exception)
                        {
                            Environment.Exit(0);
                        }
                    }
                }
            });

            silenceThread.IsBackground = true;
            silenceThread.Priority = ThreadPriority.Lowest;
            silenceThread.Start();

            while (isRunning)
            {
                Thread.Sleep(500);
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Erro WASAPI: " + ex.Message);
            Environment.Exit(1);
        }
        finally
        {
            isRunning = false;
            if (capture != null) { try { capture.StopRecording(); capture.Dispose(); } catch {} }
            if (stream != null) { try { stream.Close(); } catch {} }
            if (client != null) { try { client.Close(); } catch {} }
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies $naudioDll
[WasapiStreamer]::Start($Server, $Port)
