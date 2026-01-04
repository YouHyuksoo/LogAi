from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig

class LogParser:
    def __init__(self):
        config = TemplateMinerConfig()
        import os
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        ini_path = os.path.join(base_dir, "drain3.ini")
        config.load(ini_path)
        config.drain_sim_th = 0.5  # Similarity threshold
        self.miner = TemplateMiner(None, config)

    def parse(self, log_line: str):
        result = self.miner.add_log_message(log_line)
        return {
            "template_id": result["cluster_id"],
            "template": result["template_mined"],
            "params": self.miner.extract_parameters(result["template_mined"], log_line, exact_matching=False)
            # Drain3 params extraction might need refinement depending on version
        }

parser = LogParser()
