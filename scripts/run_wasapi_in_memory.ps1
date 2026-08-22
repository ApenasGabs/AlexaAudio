param(
  [string]$Server = "127.0.0.1",
  [int]$Port = 3001
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$binDir = Join-Path (Split-Path -Parent $scriptDir) "bin"
$naudioDll = Join-Path $binDir "NAudio.dll"

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

            capture.DataAvailable += (s, e) =>
            {
                if (e.BytesRecorded > 0)
                {
                    try
                    {
                        stream.Write(e.Buffer, 0, e.BytesRecorded);
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

            while (true)
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
            if (capture != null) { try { capture.StopRecording(); capture.Dispose(); } catch {} }
            if (stream != null) { try { stream.Close(); } catch {} }
            if (client != null) { try { client.Close(); } catch {} }
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies $naudioDll
[WasapiStreamer]::Start($Server, $Port)
