using System;
using System.IO;
using System.Threading;
using NAudio.Wave;

namespace AlexaAudioLoopback
{
    class Program
    {
        static void Main(string[] args)
        {
            try
            {
                using (var capture = new WasapiLoopbackCapture())
                {
                    var stdout = Console.OpenStandardOutput();

                    // Informações do formato de áudio para o stderr
                    Console.Error.WriteLine(string.Format("SAMPLE_RATE={0}", capture.WaveFormat.SampleRate));
                    Console.Error.WriteLine(string.Format("CHANNELS={0}", capture.WaveFormat.Channels));
                    Console.Error.WriteLine(string.Format("BITS={0}", capture.WaveFormat.BitsPerSample));
                    Console.Error.WriteLine(string.Format("ENCODING={0}", capture.WaveFormat.Encoding));
                    Console.Error.Flush();

                    capture.DataAvailable += (s, a) =>
                    {
                        try
                        {
                            stdout.Write(a.Buffer, 0, a.BytesRecorded);
                            stdout.Flush();
                        }
                        catch (Exception)
                        {
                            Environment.Exit(0);
                        }
                    };

                    capture.RecordingStopped += (s, a) =>
                    {
                        Environment.Exit(0);
                    };

                    capture.StartRecording();

                    // Mantém vivo até ser interrompido
                    while (true)
                    {
                        Thread.Sleep(1000);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Erro ao capturar áudio: " + ex.Message);
                Environment.Exit(1);
            }
        }
    }
}
