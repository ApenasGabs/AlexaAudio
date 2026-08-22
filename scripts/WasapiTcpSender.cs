using System;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using NAudio.Wave;

namespace AlexaAudio
{
    class Program
    {
        static void Main(string[] args)
        {
            string host = args.Length > 0 ? args[0] : "127.0.0.1";
            int port = args.Length > 1 ? int.Parse(args[1]) : 3001;

            TcpClient client = null;
            NetworkStream stream = null;
            WasapiLoopbackCapture capture = null;

            try
            {
                Console.WriteLine("Conectando ao servidor TCP em " + host + ":" + port + "...");
                client = new TcpClient();
                client.NoDelay = true; // Desabilita algoritmo de Nagle para baixa latência
                client.Connect(host, port);
                stream = client.GetStream();

                capture = new WasapiLoopbackCapture();

                int sampleRate = capture.WaveFormat.SampleRate;
                int channels = capture.WaveFormat.Channels;
                int bits = capture.WaveFormat.BitsPerSample;

                Console.Error.WriteLine(string.Format("WASAPI_INFO: SAMPLERATE={0}, CHANNELS={1}, BITS={2}, ENCODING={3}", 
                    sampleRate, channels, bits, capture.WaveFormat.Encoding));
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
                Console.WriteLine("Captura WASAPI iniciada com sucesso em alta performance.");

                // Mantém vivo sem consumir CPU
                while (true)
                {
                    Thread.Sleep(500);
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Erro na captura de áudio: " + ex.Message);
                Environment.Exit(1);
            }
            finally
            {
                if (capture != null)
                {
                    try { capture.StopRecording(); capture.Dispose(); } catch { }
                }
                if (stream != null)
                {
                    try { stream.Close(); } catch { }
                }
                if (client != null)
                {
                    try { client.Close(); } catch { }
                }
            }
        }
    }
}
