from ai.severity_classifier import classify_severity


def run_test():
    payload = {
        'confidence': 78,
        'matchType': 'near-duplicate',
        'platform': 'youtube',
        'domainReputation': 'unknown',
        'assetType': 'video',
    }

    result = classify_severity(payload)
    print('Classification result:')
    print(result)


if __name__ == '__main__':
    run_test()
