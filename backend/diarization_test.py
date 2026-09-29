import os
from faster_whisper import WhisperModel
from pyannote.audio import Pipeline

AUDIO_FILE = r"test-audio\test_diarization.wav"

HF_TOKEN = os.getenv("HF_TOKEN")

if not HF_TOKEN:
    raise RuntimeError("HF_TOKEN is not set.")

print("Loading Whisper model...")
whisper_model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8"
)

print("Loading speaker diarization model...")
diarization_pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-community-1",
    token=HF_TOKEN,
)

print("Models loaded.")
print("Starting processing...")

# -----------------------------
# 1. Whisper transcription
# -----------------------------

print("\nTranscribing audio...")

segments, info = whisper_model.transcribe(
    AUDIO_FILE
)

transcript_segments = []

for segment in segments:
    transcript_segments.append({
        "start": float(segment.start),
        "end": float(segment.end),
        "text": segment.text.strip()
    })

print("Transcription completed.")

# -----------------------------
# 2. Speaker diarization
# -----------------------------

print("\nDetecting speakers...")

diarization = diarization_pipeline(
    AUDIO_FILE,
    num_speakers=2
)

speaker_segments = []

for turn, speaker in diarization.speaker_diarization:
    speaker_segments.append({
        "start": float(turn.start),
        "end": float(turn.end),
        "speaker": speaker
    })

print("Speaker detection completed.")

# -----------------------------
# 3. Match transcript
# -----------------------------

def overlap(a_start, a_end, b_start, b_end):
    return max(
        0.0,
        min(a_end, b_end) - max(a_start, b_start)
    )


final_transcript = []

for segment in transcript_segments:

    best_speaker = "UNKNOWN"
    best_overlap = 0.0

    for speaker_segment in speaker_segments:

        current_overlap = overlap(
            segment["start"],
            segment["end"],
            speaker_segment["start"],
            speaker_segment["end"]
        )

        if current_overlap > best_overlap:
            best_overlap = current_overlap
            best_speaker = speaker_segment["speaker"]

    final_transcript.append({
        "start": segment["start"],
        "end": segment["end"],
        "speaker": best_speaker,
        "text": segment["text"]
    })

# -----------------------------
# 4. Convert speaker names
# -----------------------------

speaker_map = {}

speaker_counter = 1

for item in final_transcript:

    speaker = item["speaker"]

    if speaker not in speaker_map:
        speaker_map[speaker] = f"Speaker {speaker_counter}"
        speaker_counter += 1

    item["speaker"] = speaker_map[speaker]

# -----------------------------
# 5. Display final result
# -----------------------------

print("\n================================")
print("FINAL MEETING TRANSCRIPT")
print("================================\n")

for item in final_transcript:

    minutes = int(item["start"] // 60)
    seconds = int(item["start"] % 60)

    timestamp = f"{minutes:02d}:{seconds:02d}"

    print(
        f"[{timestamp}] {item['speaker']}:"
    )

    print(
        item["text"]
    )

    print()

print("Processing completed successfully.")